import { SOURCE_LABELS, sourceLabel } from '@/lib/offers/sources'

describe('sourceLabel', () => {
  it('maps every known scraper source to a display label', () => {
    expect(SOURCE_LABELS.jsearch).toBe('JSearch')
    expect(SOURCE_LABELS.france_travail).toBe('France Travail')
    expect(SOURCE_LABELS.eures).toBe('EURES')
    expect(SOURCE_LABELS.adzuna).toBe('Adzuna')
    expect(SOURCE_LABELS.jooble).toBe('Jooble')
    expect(SOURCE_LABELS.reed).toBe('Reed')
    expect(SOURCE_LABELS.email).toBe('Email')
  })

  it('falls back to the raw source when unknown', () => {
    expect(sourceLabel('autre_source')).toBe('autre_source')
  })

  it('falls back to "Inconnu" when the source is null or empty', () => {
    expect(sourceLabel(null)).toBe('Inconnu')
    expect(sourceLabel('')).toBe('Inconnu')
  })
})
