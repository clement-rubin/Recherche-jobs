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
  'passionné', 'passionnée', 'passionate', 'dynamique', 'dynamic', 'rigoureux', 'rigoureuse', 'rigorous',
  'très motivé', 'highly motivated', 'leader du secteur', 'industry leader', 'votre entreprise',
  'your company', 'je me permets', 'opportunité', 'opportunités', 'opportunity', 'opportunities',
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function findBannedTerms(text: string): string[] {
  return BANNED.filter(term => new RegExp(`(?<![\\p{L}])${escapeRe(term)}(?![\\p{L}])`, 'iu').test(text))
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

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
  let o: any
  try { o = JSON.parse(raw) } catch { throw new InvalidAnalysisError('JSON invalide') }
  if (!o || typeof o !== 'object') throw new InvalidAnalysisError('JSON invalide')
  if (!o.offre || typeof o.offre !== 'object' || !asString(o.offre.titre)) throw new InvalidAnalysisError('offre.titre manquant')
  if (!Array.isArray(o.exigences)) throw new InvalidAnalysisError('exigences manquantes')
  if (!o.accroche || typeof o.accroche.texte !== 'string') throw new InvalidAnalysisError('accroche.texte manquant')

  const offre: OfferInfo = {
    titre: o.offre.titre.trim(),
    entreprise: asString(o.offre.entreprise),
    publie_par_intermediaire: o.offre.publie_par_intermediaire === true,
    lieu: asString(o.offre.lieu),
    teletravail: asString(o.offre.teletravail),
    type_contrat: ['stage', 'alternance'].includes(o.offre.type_contrat) ? o.offre.type_contrat : 'autre',
    duree: asString(o.offre.duree),
    date_debut: asString(o.offre.date_debut),
    date_limite: typeof o.offre.date_limite === 'string' && isValidIsoDate(o.offre.date_limite) ? o.offre.date_limite : null,
    niveau_etudes: asString(o.offre.niveau_etudes),
    langue_offre: ['fr', 'en'].includes(o.offre.langue_offre) ? o.offre.langue_offre : 'autre',
  }

  const exigences: Requirement[] = o.exigences
    .filter((e: any) => asString(e?.competence))
    .map((e: any) => ({
      competence: e.competence.trim(),
      obligatoire: e.obligatoire !== false,
      present: e.present === true,
      preuve_cv: e.present === true ? asString(e.preuve_cv) : null,
      bloquante: e.bloquante === true && e.obligatoire !== false && e.present !== true,
    }))

  return {
    offre,
    soft_skills: asStringArray(o.soft_skills),
    langues: (Array.isArray(o.langues) ? o.langues : [])
      .filter((l: any) => asString(l?.langue))
      .map((l: any) => ({ langue: l.langue.trim(), niveau: asString(l.niveau), obligatoire: l.obligatoire !== false })),
    mots_cles_ats: asStringArray(o.mots_cles_ats).slice(0, 15),
    exigences,
    domaine_coherent: o.domaine_coherent === true,
    accroche: {
      texte: o.accroche.texte.trim(),
      valeur_citee: asString(o.accroche.valeur_citee),
      experience_cv_liee: asString(o.accroche.experience_cv_liee),
      avertissement: asString(o.accroche.avertissement),
    },
    raison: asString(o.raison) ?? '',
    recommandations_cv: (Array.isArray(o.recommandations_cv) ? o.recommandations_cv : [])
      .filter((r: any) => asString(r?.texte_suggere))
      .slice(0, 5)
      .map((r: any) => ({
        section: asString(r.section) ?? 'CV',
        action: ['ajouter', 'reformuler', 'mettre_en_avant', 'retirer'].includes(r.action) ? r.action : 'reformuler',
        texte_actuel: asString(r.texte_actuel),
        texte_suggere: r.texte_suggere.trim(),
        source_cv_maitre: asString(r.source_cv_maitre),
      })),
  }
}

export async function analyzeOffer(input: AnalyzeInput, deps: AnalyzeDeps = defaultDeps): Promise<AnalysisResult> {
  const { profile, research, today } = input
  const cvUtilise: 'fr' | 'en' = input.lang === 'fr' ? 'fr' : 'en'
  const cvEnvoye = (cvUtilise === 'fr' ? profile.cv_fr : profile.cv_en) ?? profile.cv_maitre
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

  const scoreGlobal = computeMatchScore(parsed.exigences, parsed.domaine_coherent)
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

  const accroche = { ...parsed.accroche }
  if (research.statut === 'insuffisante') accroche.valeur_citee = null
  if (accroche.valeur_citee) {
    const known = [...research.valeurs.map(v => v.valeur), ...research.actualites.map(a => a.resume)].map(fold)
    const cited = fold(accroche.valeur_citee)
    if (!known.some(k => k.includes(cited) || cited.includes(k))) {
      accroche.valeur_citee = null
      avertissements.push("Valeur citée introuvable dans la recherche entreprise : à vérifier avant d'utiliser l'accroche.")
    }
  }

  const banned = findBannedTerms(accroche.texte)
  if (banned.length > 0) avertissements.push(`Mots à éviter dans l'accroche : ${banned.join(', ')}.`)
  const words = accroche.texte.split(/\s+/).filter(Boolean).length
  if (words > 60) avertissements.push(`Accroche trop longue (${words} mots, 60 maximum).`)

  if (niveau === 'expiree') accroche.texte = ''

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
    recommandations_cv: parsed.recommandations_cv,
    cv_utilise: cvUtilise,
    avertissements,
  }
}
