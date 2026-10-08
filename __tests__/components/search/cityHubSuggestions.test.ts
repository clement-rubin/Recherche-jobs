import { CITY_HUB_SUGGESTIONS } from '@/components/search/cityHubSuggestions'
import { EUROPE_COUNTRIES } from '@/components/search/countries'

describe('CITY_HUB_SUGGESTIONS', () => {
  it('has at least one hub with coordinates in Europe for every supported country', () => {
    for (const { code } of EUROPE_COUNTRIES) {
      const hubs = CITY_HUB_SUGGESTIONS[code]
      expect(hubs?.length).toBeGreaterThan(0)
      for (const hub of hubs) {
        expect(hub.name.length).toBeGreaterThan(0)
        expect(hub.lat).toBeGreaterThan(34)
        expect(hub.lat).toBeLessThan(72)
        expect(hub.lng).toBeGreaterThan(-25)
        expect(hub.lng).toBeLessThan(45)
      }
    }
  })
})
