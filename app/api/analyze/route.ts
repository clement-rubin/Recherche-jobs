export const maxDuration = 26

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { extractOffer } from '@/lib/analyzer/scraper'
import { buildOfferText } from '@/lib/analysis/offer-text'
import { runAnalysis } from '@/lib/analysis/pipeline'
import { analysisErrorResponse } from '@/lib/analysis/http'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { url?: string; manualText?: string; force?: boolean; company?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { url, manualText, force, company } = body
  if (!url) return NextResponse.json({ error: 'URL manquante' }, { status: 400 })

  const offerResult = await extractOffer(url, { manualText, force })

  if ('blocked' in offerResult) {
    return NextResponse.json({ blocked: true, domain: offerResult.domain, reason: offerResult.reason })
  }
  if ('requiresConfirmation' in offerResult) {
    return NextResponse.json({
      requiresConfirmation: true,
      domain: offerResult.domain,
      reason: offerResult.reason,
    })
  }

  const offer = offerResult
  const companyName = offer.entreprise.trim() || company?.trim() || null
  const parts = buildOfferText({
    titre: offer.titre,
    entreprise: companyName,
    lieu: offer.localisation,
    contrat: offer.type_contrat,
    description: offer.description_brute,
  })

  if (!parts.sufficient) {
    // Reuse the "paste the text" UI flow
    return NextResponse.json({ blocked: true, domain: new URL(url).hostname, reason: "Texte de l'offre introuvable sur la page" })
  }

  try {
    const analysis = await runAnalysis({
      supabase,
      userId: user.id,
      company: companyName,
      offerText: parts.text,
      description: parts.description,
    })
    return NextResponse.json({ offer, analysis })
  } catch (err) {
    return analysisErrorResponse(err)
  }
}
