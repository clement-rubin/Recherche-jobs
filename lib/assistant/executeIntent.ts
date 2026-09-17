import type { AssistantIntent } from './groq'

type RecentApp = { id: string; entreprise: string; poste: string; statut: string }

function findFuzzyMatch(recentApps: RecentApp[], entreprise: string): RecentApp | undefined {
  const needle = entreprise.toLowerCase()
  return recentApps.find(
    a => a.entreprise.toLowerCase().includes(needle) || needle.includes(a.entreprise.toLowerCase())
  )
}

function appendTimestampedNote(existingNotes: string | null, note: string): string {
  const timestamp = new Date().toLocaleDateString('fr-FR')
  return existingNotes
    ? `${existingNotes}\n[${timestamp}] ${note}`
    : `[${timestamp}] ${note}`
}

export interface ExecuteIntentParams {
  userId: string
  transcription: string
  intentResult: AssistantIntent
  recentApps: RecentApp[]
  source: string
}

// supabase is typed loosely (matches the rest of the codebase's pragmatic
// `as any` usage around Insert/Update — see lib/supabase/types.ts, whose
// hand-written Omit/Partial types don't conform cleanly to the generated
// PostgrestClient generics).
export async function executeIntent(
  supabase: any,
  params: ExecuteIntentParams
): Promise<{ executed: boolean }> {
  const { userId, transcription, intentResult, recentApps, source } = params
  const { intent, action } = intentResult
  let executed = false

  try {
    if (intent === 'update_application' && action.entreprise) {
      const match = findFuzzyMatch(recentApps, action.entreprise as string)

      if (match) {
        const VALID_STATUTS = ['en_cours', 'relance', 'termine'] as const
        const VALID_RESULTATS = ['accepte', 'refus'] as const
        const update: Record<string, unknown> = {}
        if (action.statut && VALID_STATUTS.includes(action.statut as any)) update.statut = action.statut
        if (action.resultat && VALID_RESULTATS.includes(action.resultat as any)) update.resultat = action.resultat
        if (action.note) {
          const { data: current } = await supabase.from('applications').select('notes').eq('id', match.id).single()
          update.notes = appendTimestampedNote((current as { notes: string | null } | null)?.notes ?? null, action.note as string)
        }

        if (Object.keys(update).length > 0) {
          const { error } = await supabase.from('applications').update(update).eq('id', match.id).eq('user_id', userId)
          if (!error) {
            executed = true
          } else {
            console.error('[executeIntent] update_application write failed', error)
          }
        }
      }
    } else if (intent === 'add_application' && action.entreprise) {
      const { error } = await supabase.from('applications').insert({
        user_id: userId,
        entreprise: action.entreprise as string,
        poste: (action.poste as string) ?? 'Poste à préciser',
        type_contrat: (action.type_contrat as any) ?? 'interim',
        source,
      })
      if (!error) {
        executed = true
      } else {
        console.error('[executeIntent] add_application write failed', error)
      }
    } else if (intent === 'add_note' && action.entreprise && action.note) {
      const match = findFuzzyMatch(recentApps, action.entreprise as string)

      if (match) {
        const { data: current } = await supabase.from('applications').select('notes').eq('id', match.id).single()
        const notes = appendTimestampedNote((current as { notes: string | null } | null)?.notes ?? null, action.note as string)
        const { error } = await supabase.from('applications').update({ notes }).eq('id', match.id).eq('user_id', userId)
        if (!error) {
          executed = true
        } else {
          console.error('[executeIntent] add_note write failed', error)
        }
      }
    }

    const { error: logError } = await supabase.from('assistant_logs').insert({
      user_id: userId,
      transcription,
      intent,
      action_taken: JSON.stringify(action),
      success: executed,
    })
    if (logError) console.error('[executeIntent] assistant_logs write failed', logError)
  } catch (err) {
    console.error('[executeIntent] Action execution failed', err)
  }

  return { executed }
}
