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

describe('analyzeOffer hardening', () => {
  const rec = (over: Record<string, unknown> = {}) => ({
    section: 'Expériences', action: 'reformuler', texte_actuel: null, texte_suggere: 'Nouveau texte', source_cv_maitre: null, ...over,
  })

  it('caps the global score at 50 when no requirement was extracted', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({ exigences: [], domaine_coherent: true }))
    const r = await analyzeOffer(input(), { complete })
    // computeMatchScore([], true) = 100, capped at 50 by analyzeOffer
    expect(r.correspondance.score_global).toBe(50)
  })

  it('treats a requirement marked present without any CV proof as absent', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      exigences: [
        { competence: 'Python', obligatoire: true, present: true, preuve_cv: '   ', bloquante: false },
        { competence: 'Permis B', obligatoire: true, present: true, preuve_cv: null, bloquante: true },
        { competence: 'SQL', obligatoire: true, present: true, preuve_cv: 'Projet SQL', bloquante: true },
      ],
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.exigences[0]).toMatchObject({ present: false, preuve_cv: null, bloquante: false })
    expect(r.exigences[1]).toMatchObject({ present: false, preuve_cv: null, bloquante: true })
    expect(r.exigences[2]).toMatchObject({ present: true, preuve_cv: 'Projet SQL', bloquante: false })
    expect(r.correspondance.score_global).toBeLessThanOrEqual(40)
  })

  it('nulls a texte_actuel that is not in the CV that was sent, keeps one that is', async () => {
    const cv = 'Développé une API Flask reliant les modèles à PostgreSQL.\nStage chez  Thales'
    const complete = jest.fn().mockResolvedValue(modelOutput({
      recommandations_cv: [
        rec({ texte_actuel: 'api  flask reliant les MODELES à postgresql' }),
        rec({ texte_actuel: 'Expert Kubernetes certifié' }),
        rec({ action: 'ajouter', texte_actuel: null }),
      ],
    }))
    const r = await analyzeOffer({ ...input(), profile: { ...profile, cv_fr: cv } }, { complete })
    expect(r.recommandations_cv[0].texte_actuel).toBe('api  flask reliant les MODELES à postgresql')
    expect(r.recommandations_cv[1].texte_actuel).toBeNull()
    expect(r.recommandations_cv[2].texte_actuel).toBeNull()
  })

  it('normalises typographic apostrophes and whitespace when checking quotes', async () => {
    const cv = "Responsable de l'équipe\n\tdata"
    const complete = jest.fn().mockResolvedValue(modelOutput({
      recommandations_cv: [rec({ texte_actuel: 'l’équipe data' })],
    }))
    const r = await analyzeOffer({ ...input(), profile: { ...profile, cv_fr: cv } }, { complete })
    expect(r.recommandations_cv[0].texte_actuel).toBe('l’équipe data')
  })

  it('skips accroche warnings and blanks the accroche on an expired offer', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      offre: { titre: 'X', entreprise: 'Thales', type_contrat: 'stage', date_limite: '2026-10-01', langue_offre: 'fr' },
      accroche: { texte: 'Je suis passionné.', valeur_citee: 'Inconnue totale', experience_cv_liee: 'Fridgia', avertissement: 'x' },
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.accroche).toEqual({ texte: '', valeur_citee: null, experience_cv_liee: null, avertissement: null })
    const w = r.avertissements.join(' ')
    expect(w).not.toMatch(/Mots à éviter/)
    expect(w).not.toMatch(/introuvable/i)
  })

  it('still reports research-quality and pipeline warnings on an expired offer', async () => {
    const research = makeResearch({ statut: 'insuffisante', valeurs: [], actualites: [] })
    const complete = jest.fn().mockResolvedValue(modelOutput({
      offre: { titre: 'X', entreprise: 'Thales', type_contrat: 'stage', date_limite: '2026-10-01', langue_offre: 'fr' },
    }))
    const r = await analyzeOffer({ ...input(research), warnings: ['Recherche web indisponible'] }, { complete })
    expect(r.avertissements).toContain('Recherche web indisponible')
    expect(r.avertissements.join(' ')).toMatch(/recherche entreprise insuffisante/i)
  })

  it('refuses a cited value shorter than 8 characters even if it appears in the research', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      accroche: { texte: 'Texte.', valeur_citee: 'Confia', experience_cv_liee: null, avertissement: null },
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.accroche.valeur_citee).toBeNull()
    expect(r.avertissements.join(' ')).toMatch(/introuvable/i)
  })

  it('keeps a cited value equal to a news summary from the research', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      accroche: { texte: 'Texte.', valeur_citee: 'Contrat de défense signé', experience_cv_liee: null, avertissement: null },
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.accroche.valeur_citee).toBe('Contrat de défense signé')
    expect(r.avertissements.join(' ')).not.toMatch(/introuvable/i)
  })

  it('falls back to the master CV when the short CV is an empty string', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput())
    await analyzeOffer({ ...input(), profile: { ...profile, cv_fr: '' } }, { complete })
    const user = complete.mock.calls[0][1] as string
    expect(user).toContain('<cv_envoye>\nCV MAITRE\n</cv_envoye>')
  })

  it('keeps a "retirer" recommendation with an empty texte_suggere but drops other empty ones', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      recommandations_cv: [
        rec({ action: 'retirer', texte_actuel: 'CV FR', texte_suggere: '' }),
        rec({ action: 'reformuler', texte_suggere: '' }),
        rec({ action: 'ajouter', texte_suggere: '  ' }),
      ],
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.recommandations_cv).toHaveLength(1)
    expect(r.recommandations_cv[0]).toMatchObject({ action: 'retirer', texte_suggere: '', texte_actuel: 'CV FR' })
  })

  it('propagates a non-validation error from complete without retrying', async () => {
    const err = { status: 429 }
    const complete = jest.fn().mockRejectedValue(err)
    await expect(analyzeOffer(input(), { complete })).rejects.toBe(err)
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('ignores null and non-object entries in exigences', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      exigences: [null, 'Python', 42, { competence: 'SQL', obligatoire: true, present: false, preuve_cv: null, bloquante: false }],
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.exigences.map(e => e.competence)).toEqual(['SQL'])
  })

  it('treats present given as a string as false', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({
      exigences: [{ competence: 'SQL', obligatoire: true, present: 'true', preuve_cv: 'Projet', bloquante: false }],
    }))
    const r = await analyzeOffer(input(), { complete })
    expect(r.exigences[0]).toMatchObject({ present: false, preuve_cv: null })
  })

  it('throws InvalidAnalysisError after retry when accroche is a string', async () => {
    const complete = jest.fn().mockResolvedValue(modelOutput({ accroche: 'Une accroche' }))
    await expect(analyzeOffer(input(), { complete })).rejects.toBeInstanceOf(InvalidAnalysisError)
    expect(complete).toHaveBeenCalledTimes(2)
  })
})

describe('findBannedTerms', () => {
  it('matches plural and feminine forms', () => {
    expect(findBannedTerms('Des profils passionnés, passionnées, dynamiques et très motivés')).toEqual(
      expect.arrayContaining(['passionnés', 'passionnées', 'dynamiques', 'très motivés']),
    )
    expect(findBannedTerms('Candidate rigoureuses, très motivée')).toEqual(
      expect.arrayContaining(['rigoureuses', 'très motivée']),
    )
  })
  it('matches multi-word terms across any whitespace, including NBSP', () => {
    expect(findBannedTerms(`très${String.fromCharCode(0xa0)}motivé`)).toEqual(['très motivé'])
    expect(findBannedTerms('highly\n  motivated')).toEqual(['highly motivated'])
  })
  it('matches whole words case-insensitively, including accents', () => {
    expect(findBannedTerms('Je suis Passionné par la data')).toEqual(['passionné'])
    expect(findBannedTerms('highly motivated and dynamic')).toEqual(expect.arrayContaining(['highly motivated', 'dynamic']))
  })
  it('does not match inside another word', () => {
    expect(findBannedTerms('The dynamics of the market')).toEqual([])
  })
})
