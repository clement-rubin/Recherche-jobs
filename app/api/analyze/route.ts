export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { extractOffer } from '@/lib/analyzer/scraper'
import { researchCompany } from '@/lib/analyzer/company'
import { analyzeFit } from '@/lib/analyzer/fit'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { url?: string; manualText?: string; force?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { url, manualText, force } = body
  if (!url) return NextResponse.json({ error: 'URL manquante' }, { status: 400 })

  // Step 1: extract offer (legal check + scraping)
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

  // Step 2: company research (best-effort, does not block the response)
  let company
  try {
    company = await researchCompany(offer.entreprise)
  } catch {
    company = {
      secteur: 'hypothèse IA — non trouvé sur internet',
      taille: 'hypothèse IA — non trouvé sur internet',
      culture: 'hypothèse IA — non trouvé sur internet',
      tech_stack: [],
      actualites: [],
      sources: [],
      incertitudes: ['Recherche entreprise échouée'],
      conseils_investigation: [],
    }
  }

  // Step 3: fit analysis
  const fit = analyzeFit(offer, company)

  return NextResponse.json({ offer, company, fit })
}
