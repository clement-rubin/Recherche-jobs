/**
 * @jest-environment node
 */
import {
  researchCompany, computeStatut, normalizeCompanyName, type TavilyResult,
} from '@/lib/analysis/research'

const TODAY = '2026-10-08'

const site: TavilyResult[] = [
  { url: 'https://www.thalesgroup.com/fr/valeurs', title: 'Valeurs', content: 'Nos valeurs : intégrité, ...' },
]
const news: TavilyResult[] = [
  { url: 'https://news.example.com/thales-contrat', title: 'Thales signe un contrat', content: '...', published_date: '2026-08-14' },
]

const extraction = (over: object = {}) => JSON.stringify({
  perimetre: 'Groupe Thales',
  valeurs: [{ valeur: 'Confiance et intégrité', source_url: 'https://www.thalesgroup.com/fr/valeurs' }],
  actualites: [{ resume: 'Contrat de défense signé', date: '2026-08-14', source_url: 'https://news.example.com/thales-contrat' }],
  ...over,
})

const deps = (extractOut: string) => ({
  search: jest.fn().mockImplementation(async (_q: string, opts?: { news?: boolean }) => (opts?.news ? news : site)),
  extract: jest.fn().mockResolvedValue(extractOut),
})

describe('normalizeCompanyName', () => {
  it.each([
    ['Thales S.A.', 'thales'],
    ['  THALES  ', 'thales'],
    ['Société Générale SA', 'societe generale'],
    ['Groupe Renault', 'renault'],
    ['Acme GmbH', 'acme'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeCompanyName(input)).toBe(expected)
  })
})

describe('computeStatut', () => {
  const v = [{ valeur: 'a', source_url: 'u' }]
  const n = [{ resume: 'b', date: null, source_url: 'u' }]
  it('suffisante with both', () => expect(computeStatut(v, n)).toBe('suffisante'))
  it('partielle with one', () => {
    expect(computeStatut(v, [])).toBe('partielle')
    expect(computeStatut([], n)).toBe('partielle')
  })
  it('insuffisante with none', () => expect(computeStatut([], [])).toBe('insuffisante'))
})

describe('researchCompany', () => {
  it('keeps sourced values and news, marks suffisante and cacheable', async () => {
    const out = await researchCompany('Thales', TODAY, deps(extraction()))
    expect(out.research.statut).toBe('suffisante')
    expect(out.research.valeurs).toHaveLength(1)
    expect(out.research.actualites[0].date).toBe('2026-08')
    expect(out.research.perimetre).toBe('Groupe Thales')
    expect(out.research.date_recherche).toBe(TODAY)
    expect(out.cacheable).toBe(true)
  })

  it('drops invented URLs and recomputes the status', async () => {
    const out = await researchCompany('Thales', TODAY, deps(extraction({
      valeurs: [{ valeur: 'Inventée', source_url: 'https://invented.example.com/x' }],
    })))
    expect(out.research.valeurs).toEqual([])
    expect(out.research.statut).toBe('partielle')
  })

  it('refuses a value sourced from a news URL (values must come from the site search)', async () => {
    const out = await researchCompany('Thales', TODAY, deps(extraction({
      valeurs: [{ valeur: 'Depuis une actu', source_url: 'https://news.example.com/thales-contrat' }],
    })))
    expect(out.research.valeurs).toEqual([])
  })

  it('returns insuffisante, not cacheable, with a warning when search fails', async () => {
    const d = { search: jest.fn().mockRejectedValue(new Error('Tavily 500')), extract: jest.fn() }
    const out = await researchCompany('Thales', TODAY, d)
    expect(out.research.statut).toBe('insuffisante')
    expect(out.cacheable).toBe(false)
    expect(out.warning).toMatch(/indisponible/i)
    expect(d.extract).not.toHaveBeenCalled()
  })

  it('returns insuffisante when the extraction JSON is invalid', async () => {
    const out = await researchCompany('Thales', TODAY, deps('not json'))
    expect(out.research.statut).toBe('insuffisante')
    expect(out.cacheable).toBe(false)
  })

  it('does not search without a company name', async () => {
    const d = deps(extraction())
    const out = await researchCompany(null, TODAY, d)
    expect(out.research.statut).toBe('insuffisante')
    expect(d.search).not.toHaveBeenCalled()
    expect(out.warning).toMatch(/nom d'entreprise/i)
  })

  it('is not cacheable when nothing reliable was found', async () => {
    const out = await researchCompany('Thales', TODAY, deps(extraction({ valeurs: [], actualites: [] })))
    expect(out.research.statut).toBe('insuffisante')
    expect(out.cacheable).toBe(false)
  })
})
