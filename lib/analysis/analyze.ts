import { groqJson } from './groq'
import { InvalidAnalysisError } from './errors'
import { ANALYSIS_SYSTEM, buildAnalysisUser } from './prompt'
import { computeMatchScore, computePriority, isValidIsoDate } from './priority'
import type {
  Accroche, AnalysisResult, CandidateProfile, CompanyResearch, CvRecommendation,
  Lang, LanguageReq, OfferInfo, Requirement,
} from './types'

export interface AnalyzeInput {
  profile: CandidateProfile
  offerText: string
  lang: Lang
  research: CompanyResearch
  today: string
  warnings?: string[]
}

export interface AnalyzeDeps {
  complete: (system: string, user: string) => Promise<string>
}

const defaultDeps: AnalyzeDeps = {
  complete: (system, user) => groqJson({ model: 'llama-3.3-70b-versatile', system, user, maxTokens: 2500, temperature: 0.2 }),
}

const BANNED = [
  'passionné', 'passionnée', 'passionnés', 'passionnées', 'passionate',
  'dynamique', 'dynamiques', 'dynamic',
  'rigoureux', 'rigoureuse', 'rigoureuses', 'rigorous',
  'très motivé', 'très motivée', 'très motivés', 'highly motivated',
  'leader du secteur', 'industry leader', 'votre entreprise',
  'your company', 'je me permets', 'opportunité', 'opportunités', 'opportunity', 'opportunities',
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Multi-word terms match any run of whitespace (including NBSP) between their words.
const BANNED_RES = BANNED.map(term => ({
  term,
  re: new RegExp(`(?<![\\p{L}])${term.split(' ').map(escapeRe).join('\\s+')}(?![\\p{L}])`, 'iu'),
}))

export function findBannedTerms(text: string): string[] {
  return BANNED_RES.filter(({ re }) => re.test(text)).map(({ term }) => term)
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Folds accents and case, collapses whitespace and normalises typographic apostrophes. */
const foldQuote = (s: string) => fold(s).replace(/[‘’]/g, "'").replace(/\s+/g, ' ')

const MIN_CITED_LENGTH = 8

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim()) : []

interface ModelOutput {
  offre: OfferInfo
  soft_skills: string[]
  langues: LanguageReq[]
  mots_cles_ats: string[]
  exigences: Requirement[]
  domaine_coherent: boolean
  accroche: Accroche
  raison: string
  recommandations_cv: CvRecommendation[]
}

function parseModelOutput(raw: string): ModelOutput {
  let parsedJson: unknown
  try { parsedJson = JSON.parse(raw) } catch { throw new InvalidAnalysisError('JSON invalide') }
  if (!isRecord(parsedJson)) throw new InvalidAnalysisError('JSON invalide')
  const o = parsedJson
  const off = o.offre
  const titre = isRecord(off) ? asString(off.titre) : null
  if (!isRecord(off) || !titre) throw new InvalidAnalysisError('offre.titre manquant')
  if (!Array.isArray(o.exigences)) throw new InvalidAnalysisError('exigences manquantes')
  const acc = o.accroche
  if (!isRecord(acc) || typeof acc.texte !== 'string') throw new InvalidAnalysisError('accroche.texte manquant')

  const offre: OfferInfo = {
    titre,
    entreprise: asString(off.entreprise),
    publie_par_intermediaire: off.publie_par_intermediaire === true,
    lieu: asString(off.lieu),
    teletravail: asString(off.teletravail),
    type_contrat: off.type_contrat === 'stage' || off.type_contrat === 'alternance' ? off.type_contrat : 'autre',
    duree: asString(off.duree),
    date_debut: asString(off.date_debut),
    date_limite: typeof off.date_limite === 'string' && isValidIsoDate(off.date_limite) ? off.date_limite : null,
    niveau_etudes: asString(off.niveau_etudes),
    langue_offre: off.langue_offre === 'fr' || off.langue_offre === 'en' ? off.langue_offre : 'autre',
  }

  const exigences: Requirement[] = []
  for (const e of o.exigences) {
    if (!isRecord(e)) continue
    const competence = asString(e.competence)
    if (!competence) continue
    const preuve = e.present === true ? asString(e.preuve_cv) : null
    // "present" is only accepted with a quoted proof from the CV.
    const present = preuve !== null
    const obligatoire = e.obligatoire !== false
    exigences.push({
      competence,
      obligatoire,
      present,
      preuve_cv: preuve,
      bloquante: e.bloquante === true && obligatoire && !present,
    })
  }

  const langues: LanguageReq[] = []
  for (const l of Array.isArray(o.langues) ? o.langues : []) {
    if (!isRecord(l)) continue
    const langue = asString(l.langue)
    if (!langue) continue
    langues.push({ langue, niveau: asString(l.niveau), obligatoire: l.obligatoire !== false })
  }

  const recommandations_cv: CvRecommendation[] = []
  for (const r of Array.isArray(o.recommandations_cv) ? o.recommandations_cv : []) {
    if (!isRecord(r)) continue
    const action = (['ajouter', 'reformuler', 'mettre_en_avant', 'retirer'] as const).find(a => a === r.action) ?? 'reformuler'
    const rec: CvRecommendation = {
      section: asString(r.section) ?? 'CV',
      action,
      texte_actuel: asString(r.texte_actuel),
      texte_suggere: typeof r.texte_suggere === 'string' ? r.texte_suggere.trim() : '',
      source_cv_maitre: asString(r.source_cv_maitre),
    }
    // Removing a passage needs no replacement text; every other action does.
    if (rec.texte_suggere !== '' || rec.action === 'retirer') recommandations_cv.push(rec)
  }

  return {
    offre,
    soft_skills: asStringArray(o.soft_skills),
    langues,
    mots_cles_ats: asStringArray(o.mots_cles_ats).slice(0, 15),
    exigences,
    domaine_coherent: o.domaine_coherent === true,
    accroche: {
      texte: acc.texte.trim(),
      valeur_citee: asString(acc.valeur_citee),
      experience_cv_liee: asString(acc.experience_cv_liee),
      avertissement: asString(acc.avertissement),
    },
    raison: asString(o.raison) ?? '',
    recommandations_cv: recommandations_cv.slice(0, 5),
  }
}

export async function analyzeOffer(input: AnalyzeInput, deps: AnalyzeDeps = defaultDeps): Promise<AnalysisResult> {
  const { profile, research, today } = input
  const cvUtilise: 'fr' | 'en' = input.lang === 'fr' ? 'fr' : 'en'
  const cvEnvoye = (cvUtilise === 'fr' ? profile.cv_fr : profile.cv_en) || profile.cv_maitre
  const user = buildAnalysisUser({ profile, cvEnvoye, offerText: input.offerText, research, lang: input.lang, today })

  let parsed: ModelOutput | null = null
  let lastError: unknown
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    const raw = await deps.complete(ANALYSIS_SYSTEM, user)
    try {
      parsed = parseModelOutput(raw)
    } catch (err) {
      if (!(err instanceof InvalidAnalysisError)) throw err
      lastError = err
    }
  }
  if (!parsed) throw lastError ?? new InvalidAnalysisError()

  // With no extracted requirement the formula would hand out a free 70 points: cap it.
  const rawScore = computeMatchScore(parsed.exigences, parsed.domaine_coherent)
  const scoreGlobal = parsed.exigences.length === 0 ? Math.min(rawScore, 50) : rawScore
  const { niveau, score, urgence } = computePriority(scoreGlobal, parsed.offre.date_limite, today)

  const avertissements = [...(input.warnings ?? [])]
  if (parsed.exigences.length === 0) {
    avertissements.push("Aucune exigence extraite de l'offre : score de correspondance peu fiable.")
  }
  if (research.statut === 'insuffisante') {
    avertissements.push("Recherche entreprise insuffisante : l'accroche ne s'appuie que sur l'offre et le CV.")
  } else if (research.statut === 'partielle') {
    avertissements.push('Recherche entreprise partielle : valeurs ou actualités manquantes.')
  }

  let accroche: Accroche = { ...parsed.accroche }
  if (niveau === 'expiree') {
    // Nothing to apply to: no accroche, so no accroche-specific checks either.
    accroche = { texte: '', valeur_citee: null, experience_cv_liee: null, avertissement: null }
  } else {
    if (research.statut === 'insuffisante') accroche.valeur_citee = null
    if (accroche.valeur_citee) {
      const known = [...research.valeurs.map(v => v.valeur), ...research.actualites.map(a => a.resume)].map(fold)
      const cited = fold(accroche.valeur_citee)
      const found = cited.length >= MIN_CITED_LENGTH && known.some(k => k.includes(cited) || cited.includes(k))
      if (!found) {
        accroche.valeur_citee = null
        avertissements.push("Valeur citée introuvable dans la recherche entreprise : à vérifier avant d'utiliser l'accroche.")
      }
    }

    const banned = findBannedTerms(accroche.texte)
    if (banned.length > 0) avertissements.push(`Mots à éviter dans l'accroche : ${banned.join(', ')}.`)
    const words = accroche.texte.split(/\s+/).filter(Boolean).length
    if (words > 60) avertissements.push(`Accroche trop longue (${words} mots, 60 maximum).`)
  }

  // A quote the model attributes to the CV must really be in the CV that was sent.
  const cvNormalise = foldQuote(cvEnvoye)
  const recommandations = parsed.recommandations_cv.map(r =>
    r.texte_actuel && !cvNormalise.includes(foldQuote(r.texte_actuel)) ? { ...r, texte_actuel: null } : r)

  return {
    offre: parsed.offre,
    soft_skills: parsed.soft_skills,
    langues: parsed.langues,
    mots_cles_ats: parsed.mots_cles_ats,
    exigences: parsed.exigences,
    correspondance: { score_global: scoreGlobal, domaine_coherent: parsed.domaine_coherent },
    entreprise_recherche: research,
    accroche,
    priorite: { niveau, score, urgence, raison: niveau === 'expiree' ? 'Date limite dépassée.' : parsed.raison },
    recommandations_cv: recommandations,
    cv_utilise: cvUtilise,
    avertissements,
  }
}
