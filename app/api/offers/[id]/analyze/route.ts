export const maxDuration = 26

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { offerToText } from '@/lib/analysis/offer-text'
import { runAnalysis } from '@/lib/analysis/pipeline'
import { analysisErrorResponse } from '@/lib/analysis/http'
import type { Offer } from '@/lib/supabase/types'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { text?: string } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  const { data: offer } = await supabase
    .from('offers').select('*').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!offer) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })

  const parts = offerToText(offer as Offer, typeof body.text === 'string' ? body.text : undefined)
  if (!parts.sufficient) return NextResponse.json({ needsText: true })

  try {
    const analysis = await runAnalysis({
      supabase,
      userId: user.id,
      company: (offer as Offer).entreprise,
      offerText: parts.text,
      description: parts.description,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('offers')
      .update({ analysis, priority_score: analysis.priorite.score, analyzed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) {
      // The analysis is valid and costly to produce: return it even if saving failed.
      console.error('[analysis] failed to persist analysis', error.message)
      return NextResponse.json({ analysis, persisted: false })
    }
    return NextResponse.json({ analysis, persisted: true })
  } catch (err) {
    return analysisErrorResponse(err)
  }
}
