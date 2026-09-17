import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { processIntent } from '@/lib/assistant/groq'
import { executeIntent } from '@/lib/assistant/executeIntent'
import { sendTelegramMessage } from '@/lib/telegram'
import type { Application } from '@/lib/supabase/types'

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
  }
}

async function safeSend(text: string) {
  try {
    await sendTelegramMessage(text)
  } catch (err) {
    console.error('[telegram/webhook] Failed to send reply', err)
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn('[telegram/webhook] Invalid secret token')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update: TelegramUpdate = await req.json()
  const message = update.message
  if (!message?.text) {
    return NextResponse.json({ ok: true })
  }

  if (message.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) {
    console.warn('[telegram/webhook] Message from unknown chat', { chatId: message.chat.id })
    return NextResponse.json({ ok: true })
  }

  const userId = process.env.TELEGRAM_OWNER_USER_ID
  if (!userId) {
    console.error('[telegram/webhook] TELEGRAM_OWNER_USER_ID not set')
    await safeSend('❌ Assistant indisponible, réessaie dans quelques secondes')
    return NextResponse.json({ ok: true })
  }

  const supabase = createAdminSupabase()
  const { data: applications } = await supabase
    .from('applications')
    .select('id, entreprise, poste, statut')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(10)

  const recentApps = ((applications ?? []) as Partial<Application>[]).map(a => ({
    id: a.id ?? '',
    entreprise: a.entreprise ?? '',
    poste: a.poste ?? '',
    statut: a.statut ?? 'en_cours',
  }))

  let intentResult
  try {
    intentResult = await processIntent(message.text, recentApps)
  } catch (err) {
    console.error('[telegram/webhook] Groq error', err)
    await safeSend('❌ Assistant indisponible, réessaie dans quelques secondes')
    return NextResponse.json({ ok: true })
  }

  const { intent, action } = intentResult
  const entreprise = (action?.entreprise as string) ?? ''

  const isRefusal = intent === 'update_application' &&
    action?.statut === 'termine' &&
    action?.resultat === 'refus'

  if (intentResult.requires_confirmation || isRefusal) {
    await safeSend(`⚠️ ${entreprise} détecté comme refusé — confirme dans l'app pour valider`)
    return NextResponse.json({ ok: true })
  }

  if (intent === 'unknown') {
    await safeSend("🤔 Je n'ai pas compris, reformule ou utilise l'app")
    return NextResponse.json({ ok: true })
  }

  const { executed } = await executeIntent(supabase, {
    userId,
    transcription: message.text,
    intentResult,
    recentApps,
    source: 'telegram',
  })

  let reply: string
  if (intent === 'add_application' && executed) {
    reply = `✅ Ajouté : ${entreprise} — ${(action?.poste as string) ?? 'Poste à préciser'} (${(action?.type_contrat as string) ?? 'interim'})`
  } else if (intent === 'update_application' && executed) {
    reply = `✅ Mis à jour : ${entreprise} → ${(action?.resultat as string) ?? (action?.statut as string) ?? ''}`
  } else if (intent === 'add_note' && executed) {
    reply = `✅ Note ajoutée à ${entreprise}`
  } else if ((intent === 'update_application' || intent === 'add_note') && !executed) {
    reply = `🤔 Candidature "${entreprise}" introuvable dans les 10 dernières`
  } else {
    reply = "🤔 Je n'ai pas compris, reformule ou utilise l'app"
  }

  await safeSend(reply)
  return NextResponse.json({ ok: true })
}
