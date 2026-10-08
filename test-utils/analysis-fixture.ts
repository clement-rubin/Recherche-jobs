import type { AnalysisResult, CompanyResearch } from '@/lib/analysis/types'

export const makeResearch = (over: Partial<CompanyResearch> = {}): CompanyResearch => ({
  statut: 'suffisante',
  date_recherche: '2026-10-08',
  perimetre: null,
  valeurs: [{ valeur: 'Confiance et intégrité', source_url: 'https://www.thalesgroup.com/fr/valeurs' }],
  actualites: [{ resume: 'Contrat de défense signé', date: '2026-08', source_url: 'https://news.example.com/thales' }],
  ...over,
})

export const makeAnalysis = (over: Partial<AnalysisResult> = {}): AnalysisResult => ({
  offre: {
    titre: 'Stage Data Engineer', entreprise: 'Thales', publie_par_intermediaire: false,
    lieu: 'Lille', teletravail: null, type_contrat: 'stage', duree: '3 mois',
    date_debut: '2027-05', date_limite: '2026-10-20', niveau_etudes: 'Bac+4/5', langue_offre: 'fr',
  },
  soft_skills: ['Autonomie'],
  langues: [{ langue: 'Anglais', niveau: 'B2', obligatoire: true }],
  mots_cles_ats: ['Python', 'SQL'],
  exigences: [
    { competence: 'Python', obligatoire: true, present: true, preuve_cv: 'API Flask du projet Fridgia', bloquante: false },
    { competence: 'Spark', obligatoire: false, present: false, preuve_cv: null, bloquante: false },
  ],
  correspondance: { score_global: 90, domaine_coherent: true },
  entreprise_recherche: makeResearch(),
  accroche: {
    texte: "Thales mise sur la confiance et l'intégrité ; l'API Flask de Fridgia, supervisée en production, relève du même principe de fiabilité.",
    valeur_citee: 'Confiance et intégrité',
    experience_cv_liee: 'Fridgia',
    avertissement: null,
  },
  priorite: { niveau: 'haute', score: 93, urgence: 85, raison: 'Python couvert, Spark manquant.' },
  recommandations_cv: [
    { section: 'Expériences', action: 'mettre_en_avant', texte_actuel: 'API Flask reliant les modèles à PostgreSQL', texte_suggere: 'Pipeline de données Flask/PostgreSQL en production', source_cv_maitre: null },
  ],
  cv_utilise: 'fr',
  avertissements: [],
  ...over,
})
