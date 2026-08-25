import { DOMAIN_SUGGESTIONS, DOMAIN_OPTIONS, DOMAIN_LABELS } from '@/components/search/domainSuggestions'

describe('domainSuggestions', () => {
  it('has a suggestions entry for every predefined domain option except "autre"', () => {
    const predefinedKeys = DOMAIN_OPTIONS.map(o => o.value).filter(v => v !== 'autre')
    for (const key of predefinedKeys) {
      expect(DOMAIN_SUGGESTIONS[key]).toBeDefined()
      expect(DOMAIN_SUGGESTIONS[key].motsCles.length).toBeGreaterThan(0)
      expect(DOMAIN_SUGGESTIONS[key].exclusions.length).toBeGreaterThan(0)
      expect(DOMAIN_SUGGESTIONS[key].qualifications.length).toBeGreaterThan(0)
    }
  })

  it('includes an "autre" option with no suggestions entry', () => {
    expect(DOMAIN_OPTIONS.some(o => o.value === 'autre')).toBe(true)
    expect(DOMAIN_SUGGESTIONS['autre']).toBeUndefined()
  })

  it('DOMAIN_LABELS maps every option value to its label', () => {
    for (const { value, label } of DOMAIN_OPTIONS) {
      expect(DOMAIN_LABELS[value]).toBe(label)
    }
  })
})
