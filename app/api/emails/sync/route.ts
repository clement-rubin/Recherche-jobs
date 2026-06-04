import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { fetchGmailMessages, extractGmailBody, getGmailHeader, refreshGmailToken } from '@/lib/email/gmail'
import { fetchOutlookMessages, extractOutlookBody, refreshOutlookToken } from '@/lib/email/outlook'
import { parseEmailIntent } from '@/lib/email/parser'
import type { OAuthToken } from '@/lib/supabase/types'

// Validate CRON_SECRET for scheduled function calls
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getValidToken(db: any, token: OAuthToken): Promise<string> {
  const expiresAt = token.expires_at ? new Date(token.expires_at) : new Date(0)
  const isExpired = expiresAt.getTime() - Date.now() < 5 * 60 * 1000 // refresh 5min before expiry

  if (!isExpired) return token.access_token!

  if (!token.refresh_token) throw new Error(`No refresh token for ${token.provider}`)

  let newTokenData: { access_token: string; expires_in: number }
  if (token.provider === 'gmail') {
    newTokenData = await refreshGmailToken(token.refresh_token)
  } else {
    newTokenData = await refreshOutlookToken(token.refresh_token)
  }

  // Update stored token
  await db
    .from('oauth_tokens')
    .update({
      access_token: newTokenData.access_token,
      expires_at: new Date(Date.now() + newTokenData.expires_in * 1000).toISOString(),
    })
    .eq('id', token.id)

  return newTokenData.access_token
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  const authorized = user || isAuthorized(req)

  if (!authorized) {
    console.warn('[emails/sync] Unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[emails/sync] Starting', { userId: user?.id ?? 'cron' })
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24h
  const results = { gmail: 0, outlook: 0, errors: [] as string[], totalFetched: 0, skippedImported: 0, skippedAutre: 0 }

  // Get tokens: current user (manual) or all users (cron)
  let tokensResult
  if (user) {
    tokensResult = await db.from('oauth_tokens').select('*').eq('user_id', user.id)
  } else {
    tokensResult = await db.from('oauth_tokens').select('*')
  }
  const tokens: OAuthToken[] = tokensResult.data ?? []
  console.log('[emails/sync] Tokens found', { count: tokens.length, providers: tokens.map(t => t.provider) })

  for (const token of tokens) {
    try {
      const accessToken = await getValidToken(db, token)
      console.log('[emails/sync] Token valid for', token.provider)
      let messages: Array<{ id: string; sujet: string; expediteur: string; date: string; corps: string }>

      if (token.provider === 'gmail') {
        const gmailMsgs = await fetchGmailMessages(accessToken, since)
        console.log('[emails/sync] Gmail messages fetched', { count: gmailMsgs.length })
        messages = gmailMsgs.map(msg => ({
          id: msg.id,
          sujet: getGmailHeader(msg, 'Subject'),
          expediteur: getGmailHeader(msg, 'From'),
          date: msg.internalDate ? new Date(parseInt(msg.internalDate)).toISOString() : new Date().toISOString(),
          corps: extractGmailBody(msg),
        }))
      } else {
        const outlookMsgs = await fetchOutlookMessages(accessToken, since)
        messages = outlookMsgs.map(msg => ({
          id: msg.id,
          sujet: msg.subject ?? '',
          expediteur: msg.from?.emailAddress?.address ?? '',
          date: msg.receivedDateTime,
          corps: extractOutlookBody(msg),
        }))
      }

      results.totalFetched += messages.length
      console.log('[emails/sync] Messages to process', { count: messages.length, subjects: messages.slice(0, 5).map(m => m.sujet) })

      // Batch fetch already-imported email ids to avoid N+1
      const messageIds = messages.map(m => m.id)
      const { data: existingImports } = await db
        .from('email_imports')
        .select('email_id')
        .in('email_id', messageIds)
      const importedIds = new Set((existingImports ?? []).map((e: { email_id: string }) => e.email_id))

      // Sequential for...of loop keeps Groq calls sequential (no uncontrolled parallelism)
      for (const msg of messages) {
        // Skip already-imported emails (batch check, no per-message query)
        if (importedIds.has(msg.id)) {
          results.skippedImported++
          continue
        }

        // Parse intent
        const parsed = await parseEmailIntent({ sujet: msg.sujet, corps: msg.corps })
        console.log('[emails/sync] Parsed email', { sujet: msg.sujet.slice(0, 60), type: parsed.type, entreprise: parsed.entreprise })
        if (parsed.type === 'autre') {
          results.skippedAutre++
          continue
        }

        // Try to match to existing application
        let application_id: string | null = null
        if (parsed.type === 'reponse' && parsed.entreprise) {
          const { data: matchedApps } = await db
            .from('applications')
            .select('id, entreprise')
            .eq('user_id', token.user_id)
            .ilike('entreprise', `%${parsed.entreprise}%`)
            .limit(1)

          if (matchedApps && matchedApps.length > 0) {
            application_id = matchedApps[0].id
          }
        }

        // Insert email import first — prevents duplicate processing if crash occurs before application update
        await db.from('email_imports').insert({
          user_id: token.user_id,
          provider: token.provider,
          email_id: msg.id,
          expediteur: msg.expediteur,
          sujet: msg.sujet,
          date_reception: msg.date,
          type_detecte: parsed.type,
          application_id,
          parsed_data: parsed as unknown as Record<string, unknown>,
          traite: application_id !== null,
        })

        // Update application status AFTER insert (race condition fix)
        if (parsed.type === 'reponse' && application_id) {
          if (parsed.resultat === 'accepte') {
            await db
              .from('applications')
              .update({ statut: 'en_cours' })
              .eq('id', application_id)
          } else if (parsed.resultat === 'refus') {
            await db
              .from('applications')
              .update({ statut: 'termine', resultat: 'refus' })
              .eq('id', application_id)
          }
        }

        // If offre → create offer record
        if (parsed.type === 'offre') {
          await db.from('offers').insert({
            user_id: token.user_id,
            titre: parsed.poste ?? msg.sujet,
            entreprise: parsed.entreprise,
            lien: parsed.lien,
            source: 'email',
            statut: 'non_traite',
          })
        }

        if (token.provider === 'gmail') results.gmail++
        else results.outlook++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.errors.push(`${token.provider}: ${msg}`)
    }
  }

  console.log('[emails/sync] Done', results)
  return NextResponse.json({ synced: results })
}
