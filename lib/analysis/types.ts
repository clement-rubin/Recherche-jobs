export type Lang = 'fr' | 'en' | 'autre'
export type Niveau = 'haute' | 'moyenne' | 'basse' | 'expiree'
export type ResearchStatut = 'suffisante' | 'partielle' | 'insuffisante'

export interface OfferInfo {
  titre: string
  entreprise: string | null
  publie_par_intermediaire: boolean
  lieu: string | null
  teletravail: string | null
  type_contrat: 'stage' | 'alternance' | 'autre'
  duree: string | null
  date_debut: string | null
  date_limite: string | null
  niveau_etudes: string | null
  langue_offre: Lang
}

export interface LanguageReq {
  langue: string
  niveau: string | null
  obligatoire: boolean
}

export interface Requirement {
  competence: string
  obligatoire: boolean
  present: boolean
  preuve_cv: string | null
  bloquante: boolean
}

export interface Accroche {
  texte: string
  valeur_citee: string | null
  experience_cv_liee: string | null
  avertissement: string | null
}

export interface CvRecommendation {
  section: string
  action: 'ajouter' | 'reformuler' | 'mettre_en_avant' | 'retirer'
  texte_actuel: string | null
  texte_suggere: string
  source_cv_maitre: string | null
}

export interface CompanyValue { valeur: string; source_url: string }
export interface CompanyNews { resume: string; date: string | null; source_url: string }

export interface CompanyResearch {
  statut: ResearchStatut
  date_recherche: string
  perimetre: string | null
  valeurs: CompanyValue[]
  actualites: CompanyNews[]
}

export interface Priorite {
  niveau: Niveau
  score: number
  urgence: number
  raison: string
}

export interface AnalysisResult {
  offre: OfferInfo
  soft_skills: string[]
  langues: LanguageReq[]
  mots_cles_ats: string[]
  exigences: Requirement[]
  correspondance: { score_global: number; domaine_coherent: boolean }
  entreprise_recherche: CompanyResearch
  accroche: Accroche
  priorite: Priorite
  recommandations_cv: CvRecommendation[]
  cv_utilise: 'fr' | 'en'
  avertissements: string[]
}

export interface CandidateProfile {
  cv_maitre: string
  cv_fr: string | null
  cv_en: string | null
  projet_pro: string | null
}
