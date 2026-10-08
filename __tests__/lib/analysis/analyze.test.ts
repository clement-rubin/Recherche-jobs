/**
 * @jest-environment node
 */
import { analyzeOffer, findBannedTerms } from '@/lib/analysis/analyze'
import { InvalidAnalysisError } from '@/lib/analysis/errors'
import { makeResearch } from '@/test-utils/analysis-fixture'

const TODAY = '2026-10-08'
const profile = { cv_maitre: 'CV MAITRE', cv_fr: 'CV FR', cv_en: 'CV EN', projet_pro: 'Stage data' }

const modelOutput = (over: Record<string, unknown> = {}) => JSON.stringify({
  offre: {
    titre: 'Stage Data', entreprise: 'Thales', publie_par_intermediaire: false, lieu: 'Lille',
    teletravail: null, type_contrat: 'stage', duree: '3 mois', date_debut: '2027-05',
    date_limite: '2026-10-20', niveau_etudes: null, langue_offre: 'fr',
  },
  soft_skills: ['Autonomie'],
  langues: [],
  mots_cles_ats: ['Python'],
  exigences: [
    { competence: 'Python', obligatoire: true, present: true, preuve_cv: 'Fridgia', bloquante: false },
    { competence: 'Spark', obligatoire: false, present: false, preuve_cv: null, bloquante: false },
  ],
  domaine_coherent: true,
  accroche: {
    texte: "Thales cite la confiance et l'intégrité ; Fridgia, mon API Flask en production, applique ce principe.",
    valeur_citee: 'Confiance et intégrité', experience_cv_liee: 'Fridgia', avertissement: null,
  },
  raison: 'Python couvert, Spark absent.',
  recommandations_cv: [],
  priorite: { niveau: 'basse', score: 1 }, // must be ignored
  ...over,
})

const input = (research = makeResearch()) => ({
  profile, offerText: 'Titre : Stage Data', lang: 'fr' as const, research, today: TODAY,
})

describe('analyzeOffer', () => {
  it('computes scores in code and ignores the model priority', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput())
    const r = await analyzeOffer(input(), { complete })
    // 70 + (0/1 souhaitee = 0) + 10 domain = 80 ; deadline +12 days -> urgence 85 ; 0.7*80 + 0.3*85 = 81.5 -> 82
    expect(r.correspondance.score_global).toBe(80)
    expect(r.priorite).toMatchObject({ niveau: 'haute', score: 82, urgence: 85 })
    expect(r.priorite.raison).toBe('Python couvert, Spark absent.')
    expect(r.cv_utilise).toBe('fr')
    expect(r.entreprise_recherche).toEqual(makeResearch())
  })

  it('sends the master CV and only the matching short CV', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput())
    await analyzeOffer(input(), { complete })
    const user = complete.mock.calls[0][1] as string
    expect(user).toContain('CV MAITRE')
    expect(user).toContain('CV FR')
    expect(user).not.toContain('CV EN')

    complete.mockClear().mockResolvedValue(modelOutput())
    await analyzeOffer({ ...input(), lang: 'autre' }, { complete })
    const user2 = complete.mock.calls[0][1] as string
    expect(user2).toContain('CV EN')
    expect(user2).not.toContain('CV FR')
  })

  it('retries once on invalid JSON then succeeds', async () => {
    const complete = jest.fn().mockResolvedValueOnce('not json').mockResolvedValueOnce(modelOutput())
    const r = await analyzeOffer(input(), { complete })
    expect(complete).toHaveBeenCalledTimes(2)
    expect(r.offre.titre).toBe('Stage Data')
  })

  it('throws InvalidAnalysisError after two invalid answers', async () => {
    const complete = jest.fn().mockResolvedValue('{"offre": {}}')
    await expect(analyzeOffer(input(), { complete })).rejects.toBeInstanceOf(InvalidAnalysisError)
    expect(complete).toHaveBeenCalledTimes(2)
  })

  it('blanks the accroche and zeroes the score when the deadline has passed', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      offre: { titre: 'X', entreprise: 'Thales', type_contrat: 'stage', date_limite: '2026-10-01', langue_offre: 'fr' },
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.priorite).toMatchObject({ niveau: 'expiree', score: 0 })
    expect(r.accroche.texte).toBe('')
  })

  it('warns on banned words and on accroche longer than 60 words', async () => {
    const long = Array(70).fill('mot').join(' ')
    const complete = jest.fn().mockResolvedValue(modelOutput({
      accroche: { texte: `Je suis passionné. ${long}`, valeur_citee: null, experience_cv_liee: null, avertissement: null },
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.avertissements.join(' ')).toMatch(/passionné/)
    expect(r.avertissements.join(' ')).toMatch(/trop longue/i)
  })

  it('nulls a cited value that is not in the research and warns', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      accroche: { texte: 'Texte.', valeur_citee: 'Excellence opérationnelle', experience_cv_liee: null, avertissement: null },
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.accroche.valeur_citee).toBeNull()
    expect(r.avertissements.join(' ')).toMatch(/introuvable/i)
  })

  it('forces valeur_citee null and adds a warning when research is insuffisante', async () => {
    const research = makeResearch({ statut: 'insuffisante', valeurs: [], actualites: [] })
    const complete = jest.fn().mockResolvedValue(modelOutput())
    const r = await analyzeOffer(input(research), { complete })
    expect(r.accroche.valeur_citee).toBeNull()
    expect(r.avertissements.join(' ')).toMatch(/recherche entreprise insuffisante/i)
  })

  it('carries over warnings passed in by the pipeline', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput())
    const r = await analyzeOffer({ ...input(), warnings: ['Recherche web indisponible'] }, { complete })
    expect(r.avertissements).toContain('Recherche web indisponible')
  })

  it('warns that the match score is unreliable when no requirement was extracted', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({ exigences: [] }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.exigences).toEqual([])
    expect(r.avertissements).toContain("Aucune exigence extraite de l'offre : score de correspondance peu fiable.")
  })

  it('does not add the empty-requirements warning when requirements exist', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput())
    const r = await analyzeOffer(input(), { complete })
    expect(r.avertissements.join(' ')).not.toMatch(/aucune exigence/i)
  })

  it('drops an impossible calendar date_limite instead of using it', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      offre: { titre: 'X', entreprise: 'Thales', type_contrat: 'stage', date_limite: '2026-02-31', langue_offre: 'fr' },
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.offre.date_limite).toBeNull()
    expect(r.priorite.urgence).toBe(50)
  })
})

describe('findBannedTerms', () => {
  it('matches whole words case-insensitively, including accents', () => {
    expect(findBannedTerms('Je suis Passionné par la data')).toEqual(['passionné'])
    expect(findBannedTerms('highly motivated and dynamic')).toEqual(expect.arrayContaining(['highly motivated', 'dynamic']))
  })
  it('does not match inside another word', () => {
    expect(findBannedTerms('The dynamics of the market')).toEqual([])
  })
})
