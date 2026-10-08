/**
 * @jest-environment node
 */
import {
  researchCompany, computeStatut, normalizeCompanyName, tavilySearch, type TavilyResult,
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

  it('falls back to the lowercased trimmed name when normalisation empties it', () => {
    expect(normalizeCompanyName('  Groupe SA ')).toBe('groupe sa')
    expect(normalizeCompanyName(' 豊田 ')).toBe('豊田')
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

  describe('partial search failure', () => {
    beforeEach(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}) })
    afterEach(() => { jest.restoreAllMocks() })

    it('continues with the news results when the site search fails, warns and does not cache', async () => {
      const d = {
        search: jest.fn().mockImplementation(async (_q: string, opts?: { news?: boolean }) => {
          if (!opts?.news) throw new Error('Tavily 500')
          return news
        }),
        extract: jest.fn().mockResolvedValue(extraction({ valeurs: [] })),
      }
      const out = await researchCompany('Thales', TODAY, d)
      expect(d.extract).toHaveBeenCalledTimes(1)
      expect(d.extract.mock.calls[0][1]).toContain('https://news.example.com/thales-contrat')
      expect(out.research.statut).toBe('partielle')
      expect(out.research.actualites).toHaveLength(1)
      expect(out.warning).toBe('Recherche web partielle')
      expect(out.cacheable).toBe(false)
    })

    it('continues with the site results when the news search fails, warns and does not cache', async () => {
      const d = {
        search: jest.fn().mockImplementation(async (_q: string, opts?: { news?: boolean }) => {
          if (opts?.news) throw new Error('timeout')
          return site
        }),
        extract: jest.fn().mockResolvedValue(extraction({ actualites: [] })),
      }
      const out = await researchCompany('Thales', TODAY, d)
      expect(out.research.statut).toBe('partielle')
      expect(out.research.valeurs).toHaveLength(1)
      expect(out.warning).toBe('Recherche web partielle')
      expect(out.cacheable).toBe(false)
    })

    it('reports the search as unavailable when both searches fail', async () => {
      const d = { search: jest.fn().mockRejectedValue(new Error('down')), extract: jest.fn() }
      const out = await researchCompany('Thales', TODAY, d)
      expect(out.warning).toMatch(/indisponible/i)
      expect(out.cacheable).toBe(false)
      expect(d.extract).not.toHaveBeenCalled()
    })
  })

  it('caps value and summary lengths and dedupes values ignoring case and accents', async () => {
    const out = await researchCompany('Thales', TODAY, deps(extraction({
      valeurs: [
        { valeur: 'Intégrité '.repeat(30), source_url: 'https://www.thalesgroup.com/fr/valeurs' },
        { valeur: 'Responsabilité', source_url: 'https://www.thalesgroup.com/fr/valeurs' },
        { valeur: 'RESPONSABILITE', source_url: 'https://www.thalesgroup.com/fr/valeurs' },
      ],
      actualites: [{ resume: 'x'.repeat(500), date: null, source_url: 'https://news.example.com/thales-contrat' }],
    })))
    expect(out.research.valeurs).toHaveLength(2)
    expect(out.research.valeurs[0].valeur.length).toBeLessThanOrEqual(150)
    expect(out.research.valeurs[1].valeur).toBe('Responsabilité')
    expect(out.research.actualites[0].resume).toHaveLength(300)
  })

  it('accepts only a valid month in the news date', async () => {
    const withDate = (date: string) => researchCompany('Thales', TODAY, deps(extraction({
      actualites: [{ resume: 'Contrat signé', date, source_url: 'https://news.example.com/thales-contrat' }],
    })))
    expect((await withDate('2026-13')).research.actualites[0].date).toBeNull()
    expect((await withDate('2026-00-10')).research.actualites[0].date).toBeNull()
    expect((await withDate('2026-12-31')).research.actualites[0].date).toBe('2026-12')
  })

  it.each(['null', '[]', '"texte"'])('returns insuffisante and does not cache when extraction output is %s', async raw => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await researchCompany('Thales', TODAY, deps(raw))
    expect(out.research.statut).toBe('insuffisante')
    expect(out.cacheable).toBe(false)
    jest.restoreAllMocks()
  })
})

describe('tavilySearch', () => {
  const realFetch = global.fetch
  const realKey = process.env.TAVILY_API_KEY
  let fetchMock: jest.Mock

  const respond = (body: unknown, ok = true, status = 200) =>
    fetchMock.mockResolvedValue({ ok, status, json: async () => body })

  beforeEach(() => {
    process.env.TAVILY_API_KEY = 'test-key'
    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => {
    global.fetch = realFetch
    if (realKey === undefined) delete process.env.TAVILY_API_KEY
    else process.env.TAVILY_API_KEY = realKey
  })

  it('POSTs a general search with the bearer key and no days filter', async () => {
    respond({ results: [{ url: 'https://a.example.com', title: 'A', content: 'texte' }] })
    const out = await tavilySearch('Thales valeurs')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.tavily.com/search')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer test-key')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ query: 'Thales valeurs', topic: 'general' })
    expect(body).not.toHaveProperty('days')
    expect(out).toEqual([{ url: 'https://a.example.com', title: 'A', content: 'texte' }])
  })

  it('uses the news topic over the last 365 days when news is requested', async () => {
    respond({ results: [] })
    await tavilySearch('Thales actualités', { news: true })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ topic: 'news', days: 365 })
  })

  it('drops results without a usable url and keeps published_date when present', async () => {
    respond({
      results: [
        { title: 'no url', content: 'x' },
        { url: '', title: 'empty url', content: 'x' },
        { url: 42, title: 'numeric url', content: 'x' },
        { url: 'https://ok.example.com', title: 'ok', content: 'y', published_date: '2026-08-14' },
      ],
    })
    expect(await tavilySearch('q')).toEqual([
      { url: 'https://ok.example.com', title: 'ok', content: 'y', published_date: '2026-08-14' },
    ])
  })

  it('throws on a non-ok response', async () => {
    respond({}, false, 500)
    await expect(tavilySearch('q')).rejects.toThrow('Tavily 500')
  })

  it('throws without TAVILY_API_KEY and does not call fetch', async () => {
    delete process.env.TAVILY_API_KEY
    await expect(tavilySearch('q')).rejects.toThrow(/TAVILY_API_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
