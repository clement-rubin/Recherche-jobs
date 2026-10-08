/* eslint-disable @typescript-eslint/no-require-imports */
// Regenerates public/geo/europe-countries.json (map location picker) from
// Natural Earth 1:50m borders (world-atlas). Run: node scripts/build-europe-geo.cjs
// 1:50m is needed: 1:110m has no Malta or Liechtenstein.
const fs = require('fs')
const path = require('path')
const { feature } = require('topojson-client')
const topology = require('world-atlas/countries-50m.json')

// ISO 3166-1 numeric → alpha-2, for the countries in components/search/countries.ts
const ISO_NUMERIC_TO_ISO2 = {
  '250': 'FR', '276': 'DE', '040': 'AT', '056': 'BE', '100': 'BG', '196': 'CY',
  '191': 'HR', '208': 'DK', '724': 'ES', '233': 'EE', '246': 'FI', '300': 'GR',
  '348': 'HU', '372': 'IE', '352': 'IS', '380': 'IT', '428': 'LV', '438': 'LI',
  '440': 'LT', '442': 'LU', '470': 'MT', '578': 'NO', '528': 'NL', '616': 'PL',
  '620': 'PT', '203': 'CZ', '642': 'RO', '826': 'GB', '703': 'SK', '705': 'SI',
  '752': 'SE', '756': 'CH',
}

// Drops overseas parts (French Guiana, Canaries, Azores, Svalbard...) so that
// fitBounds on a country stays in Europe.
const EUROPE_BOX = { minLng: -25, maxLng: 45, minLat: 34, maxLat: 72 }
const inEurope = ring => {
  const n = ring.length
  const lng = ring.reduce((s, p) => s + p[0], 0) / n
  const lat = ring.reduce((s, p) => s + p[1], 0) / n
  return lng >= EUROPE_BOX.minLng && lng <= EUROPE_BOX.maxLng && lat >= EUROPE_BOX.minLat && lat <= EUROPE_BOX.maxLat
}

const round = c => (typeof c[0] === 'number' ? [+c[0].toFixed(2), +c[1].toFixed(2)] : c.map(round))

const all = feature(topology, topology.objects.countries)
const features = all.features
  .filter(f => ISO_NUMERIC_TO_ISO2[f.id])
  .map(f => {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    const kept = polygons.filter(poly => inEurope(poly[0]))
    return {
      type: 'Feature',
      properties: { iso2: ISO_NUMERIC_TO_ISO2[f.id] },
      geometry: { type: 'MultiPolygon', coordinates: round(kept) },
    }
  })
  .filter(f => f.geometry.coordinates.length > 0)

const out = path.join(__dirname, '..', 'public', 'geo', 'europe-countries.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }))
console.log(`Wrote ${features.length} countries to ${out}`)
