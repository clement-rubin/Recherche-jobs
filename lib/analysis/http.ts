import { NextResponse } from 'next/server'
import { InvalidAnalysisError, ProfileMissingError } from './errors'

export function analysisErrorResponse(err: unknown) {
  if (err instanceof ProfileMissingError) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
  if ((err as { status?: number } | null)?.status === 429) {
    return NextResponse.json({ error: 'Limite Groq atteinte, réessaie dans 1 min' }, { status: 429 })
  }
  if (err instanceof InvalidAnalysisError) {
    return NextResponse.json({ error: 'Analyse invalide, réessaie' }, { status: 502 })
  }
  console.error('[analysis] unexpected error', err)
  return NextResponse.json({ error: "Erreur pendant l'analyse" }, { status: 500 })
}
