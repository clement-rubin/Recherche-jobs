import { readFileSync } from 'fs'
import path from 'path'
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import { EUROPE_COUNTRIES } from '@/components/search/countries'

const geo = JSON.parse(
  readFileSync(path.join(process.cwd(), 'public/geo/europe-countries.json'), 'utf8')
) as FeatureCollection<Polygon | MultiPolygon, { iso2: string }>

const allPositions = (g: Polygon | MultiPolygon): Position[] =>
  g.type === 'Polygon' ? g.coordinates.flat() : g.coordinates.flat(2)

describe('public/geo/europe-countries.json', () => {
  it('contains exactly one feature per supported country', () => {
    const codes = geo.features.map(f => f.properties.iso2).sort()
    expect(codes).toEqual(EUROPE_COUNTRIES.map(c => c.code).sort())
  })

  it('has no overseas territories (every point inside the Europe box)', () => {
    for (const f of geo.features) {
      for (const [lng, lat] of allPositions(f.geometry)) {
        expect(lng).toBeGreaterThanOrEqual(-26)
        expect(lng).toBeLessThanOrEqual(46)
        expect(lat).toBeGreaterThanOrEqual(33)
        expect(lat).toBeLessThanOrEqual(73)
      }
    }
  })
})
