import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { processIntent } from '@/lib/assistant/groq'
import { executeIntent } from '@/lib/assistant/executeIntent'
import type { Application } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn('[assistant/process] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { transcription } = await req.json()
  if (!transcription?.trim()) {
    return NextResponse.json({ error: 'Transcription required' }, { status: 400 })
  }
  if (transcription.length > 1000) {
    return NextResponse.json({ error: 'Transcription trop longue' }, { status: 400 })
  }

  console.log('[assistant/process] Request', { userId: user.id, transcriptionLength: transcription.length })

  // Fetch recent applications for context
  const { data: applications } = await supabase
    .from('applications')
    .select('id, entreprise, poste, statut')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(10)

  const recentApps = (applications ?? []).map((a: Partial<Application>) => ({
    id: a.id ?? '',
    entreprise: a.entreprise ?? '',
    poste: a.poste ?? '',
    statut: a.statut ?? 'en_cours',
  }))

  let intentResult
  try {
    intentResult = await processIntent(transcription, recentApps)
    console.log('[assistant/process] Groq intent', { intent: intentResult.intent, confidence: intentResult.confidence, ms: Date.now() - t0 })
  } catch (err) {
    console.error('[assistant/process] Groq error', err)
    return NextResponse.json(
      { error: 'Assistant unavailable', message: "Je ne suis pas disponible pour l'instant. Réessayez dans quelques secondes." },
      { status: 503 }
    )
  }

  // Enforce requires_confirmation server-side for refusals (don't rely on LLM alone)
  const isRefusal = intentResult.intent === 'update_application' &&
    intentResult.action?.statut === 'termine' &&
    intentResult.action?.resultat === 'refus'

  if (intentResult.requires_confirmation || isRefusal) {
    return NextResponse.json({ ...intentResult, requires_confirmation: true, executed: false })
  }

  const { executed } = await executeIntent(supabase, {
    userId: user.id,
    transcription,
    intentResult,
    recentApps,
    source: 'assistant',
  })

  console.log('[assistant/process] Done', { intent: intentResult.intent, executed, totalMs: Date.now() - t0 })
  return NextResponse.json({ ...intentResult, executed })
}
