import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { processIntent } from '@/lib/assistant/groq'
import type { Application } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transcription } = await req.json()
  if (!transcription?.trim()) {
    return NextResponse.json({ error: 'Transcription required' }, { status: 400 })
  }

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
  } catch (err) {
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

  // Execute the action
  let executed = false
  const { intent, action } = intentResult

  try {
    if (intent === 'update_application' && action.entreprise) {
      // Find matching application
      const match = recentApps.find(
        a => a.entreprise.toLowerCase().includes((action.entreprise as string).toLowerCase()) ||
          (action.entreprise as string).toLowerCase().includes(a.entreprise.toLowerCase())
      )

      if (match) {
        const update: Record<string, unknown> = {}
        if (action.statut) update.statut = action.statut
        if (action.resultat) update.resultat = action.resultat
        if (action.note) {
          // Append note to existing notes
          const { data: current } = await (supabase as any)
            .from('applications')
            .select('notes')
            .eq('id', match.id)
            .single()

          const existingNotes = (current as { notes: string | null } | null)?.notes ?? ''
          const timestamp = new Date().toLocaleDateString('fr-FR')
          update.notes = existingNotes
            ? `${existingNotes}\n[${timestamp}] ${action.note}`
            : `[${timestamp}] ${action.note}`
        }

        if (Object.keys(update).length > 0) {
          await (supabase as any)
            .from('applications')
            .update(update)
            .eq('id', match.id)
            .eq('user_id', user.id)
          executed = true
        }
      }
    } else if (intent === 'add_application' && action.entreprise) {
      await supabase.from('applications').insert({
        user_id: user.id,
        entreprise: action.entreprise as string,
        poste: (action.poste as string) ?? 'Poste à préciser',
        type_contrat: (action.type_contrat as any) ?? 'interim',
        source: 'assistant',
      } as any)
      executed = true
    }

    // Log the interaction
    await supabase.from('assistant_logs').insert({
      user_id: user.id,
      transcription,
      intent,
      action_taken: JSON.stringify(action),
      success: executed,
    } as any)
  } catch (err) {
    console.error('Assistant action failed:', err)
  }

  return NextResponse.json({ ...intentResult, executed })
}
