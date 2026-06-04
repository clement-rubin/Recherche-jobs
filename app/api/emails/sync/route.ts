import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { fetchGmailMessages, extractGmailBody, getGmailHeader, refreshGmailToken } from '@/lib/email/gmail'
import { parseEmailIntent } from '@/lib/email/parser'
import type { OAuthToken } from '@/lib/supabase/types'

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getValidToken(db: any, token: OAuthToken): Promise<string> {
  const expiresAt = token.expires_at ? new Date(token.expires_at) : new Date(0)
  const isExpired = expiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (!isExpired) return token.access_token!

  if (!token.refresh_token) throw new Error(`No refresh token for ${token.provider}`)

  const newTokenData = await refreshGmailToken(token.refresh_token)

  await db
    .from('oauth_tokens')
    .update({
      access_token: newTokenData.access_token,
      expires_at: new Date(Date.now() + newTokenData.expires_in * 1000).toISOString(),
    })
    .eq('id', token.id)

  return newTokenData.access_token
}

const MAX_EMAILS_PER_SYNC = 10

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
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
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const results = { gmail: 0, errors: [] as string[], totalFetched: 0, skippedImported: 0, skippedAutre: 0 }

    let tokensResult
    if (user) {
      tokensResult = await db.from('oauth_tokens').select('*').eq('user_id', user.id).eq('provider', 'gmail')
    } else {
      tokensResult = await db.from('oauth_tokens').select('*').eq('provider', 'gmail')
    }
    const tokens: OAuthToken[] = tokensResult.data ?? []
    console.log('[emails/sync] Gmail tokens found', { count: tokens.length })

    if (tokens.length === 0) {
      console.log('[emails/sync] No Gmail token, skipping')
      return NextResponse.json({ synced: results })
    }

    for (const token of tokens) {
      try {
        const accessToken = await getValidToken(db, token)
        console.log('[emails/sync] Token valid, fetching messages...')

        const gmailMsgs = await fetchGmailMessages(accessToken, since)
        console.log('[emails/sync] Gmail raw messages', { count: gmailMsgs.length })

        const messages = gmailMsgs.map(msg => ({
          id: msg.id,
          sujet: getGmailHeader(msg, 'Subject'),
          expediteur: getGmailHeader(msg, 'From'),
          date: msg.internalDate ? new Date(parseInt(msg.internalDate)).toISOString() : new Date().toISOString(),
          corps: extractGmailBody(msg),
        }))

        results.totalFetched = messages.length
        console.log('[emails/sync] Subjects', messages.slice(0, 5).map(m => m.sujet.slice(0, 60)))

        // Filter already imported
        const messageIds = messages.map(m => m.id)
        const { data: existingImports } = await db
          .from('email_imports')
          .select('email_id')
          .in('email_id', messageIds)
        const importedIds = new Set((existingImports ?? []).map((e: { email_id: string }) => e.email_id))

        const newMessages = messages.filter(m => {
          if (importedIds.has(m.id)) {
            results.skippedImported++
            return false
          }
          return true
        })

        // Limit to prevent timeout (Netlify 26s limit)
        const toProcess = newMessages.slice(0, MAX_EMAILS_PER_SYNC)
        console.log('[emails/sync] Processing', { new: newMessages.length, capped: toProcess.length })

        for (const msg of toProcess) {
          try {
            const parsed = await parseEmailIntent({ sujet: msg.sujet, corps: msg.corps })
            console.log('[emails/sync] Parsed', { sujet: msg.sujet.slice(0, 50), type: parsed.type, entreprise: parsed.entreprise })

            if (parsed.type === 'autre') {
              results.skippedAutre++
              // Still record it so we don't re-parse next time
              await db.from('email_imports').insert({
                user_id: token.user_id,
                provider: 'gmail',
                email_id: msg.id,
                expediteur: msg.expediteur,
                sujet: msg.sujet,
                date_reception: msg.date,
                type_detecte: 'autre',
                traite: true,
              })
              continue
            }

            // Match to existing application
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

            await db.from('email_imports').insert({
              user_id: token.user_id,
              provider: 'gmail',
              email_id: msg.id,
              expediteur: msg.expediteur,
              sujet: msg.sujet,
              date_reception: msg.date,
              type_detecte: parsed.type,
              application_id,
              parsed_data: parsed as unknown as Record<string, unknown>,
              traite: application_id !== null,
            })

            if (parsed.type === 'reponse' && application_id) {
              if (parsed.resultat === 'accepte') {
                await db.from('applications').update({ statut: 'en_cours' }).eq('id', application_id)
              } else if (parsed.resultat === 'refus') {
                await db.from('applications').update({ statut: 'termine', resultat: 'refus' }).eq('id', application_id)
              }
            }

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

            results.gmail++
          } catch (emailErr) {
            const errMsg = emailErr instanceof Error ? emailErr.message : 'Unknown'
            console.error('[emails/sync] Failed to process email', { sujet: msg.sujet.slice(0, 50), error: errMsg })
            results.errors.push(`email "${msg.sujet.slice(0, 30)}": ${errMsg}`)
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[emails/sync] Token/fetch error', msg)
        results.errors.push(`gmail: ${msg}`)
      }
    }

    console.log('[emails/sync] Done', { ...results, ms: Date.now() - t0 })
    return NextResponse.json({ synced: results })
  } catch (err) {
    console.error('[emails/sync] Fatal error', err)
    return NextResponse.json(
      { error: 'Sync failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
