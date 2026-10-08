export const maxDuration = 26

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { extractOffer } from '@/lib/analyzer/scraper'
import { buildOfferText } from '@/lib/analysis/offer-text'
import { runAnalysis } from '@/lib/analysis/pipeline'
import { analysisErrorResponse } from '@/lib/analysis/http'

const safeHostname = (url: string): string => {
  try { return new URL(url).hostname } catch { return '' }
}

const asOptionalString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await req.json()
    body = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { url } = body
  if (typeof url !== 'string' || !url.trim()) {
    return NextResponse.json({ error: 'URL manquante' }, { status: 400 })
  }
  const manualText = asOptionalString(body.manualText)
  const company = asOptionalString(body.company)
  const force = body.force === true

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

  const companyName = offerResult.entreprise.trim() || company?.trim() || null
  const offer = { ...offerResult, entreprise: companyName ?? '' }
  const parts = buildOfferText({
    titre: offer.titre,
    entreprise: companyName,
    lieu: offer.localisation,
    contrat: offer.type_contrat,
    description: offer.description_brute,
  })

  if (!parts.sufficient) {
    if (manualText) {
      return NextResponse.json(
        { error: "Texte trop court : colle l'offre complète (au moins quelques paragraphes)." },
        { status: 400 },
      )
    }
    // Reuse the "paste the text" UI flow
    return NextResponse.json({ blocked: true, domain: safeHostname(url), reason: "Texte de l'offre introuvable sur la page" })
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
