# Map Location Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wizard "Villes" step's text inputs with a Leaflet map of Europe where the user clicks a country, then a city, and sets each city's radius with a slider.

**Architecture:** A static GeoJSON of the 32 supported countries (generated once from `world-atlas`) is served from `public/geo/`. A client-only `LocationMap` (react-leaflet, loaded through `next/dynamic` with `ssr: false`) draws countries, hub cities and radius circles, and reports clicks. `StepVilles` owns all logic (geocoding via `lib/geo/nominatim.ts`, dedupe, messages, sliders) so it is testable with the map mocked.

**Tech Stack:** Next.js 16 App Router, React 19, leaflet 1.9.4, react-leaflet 5.0.0, Nominatim (OSM) geocoding, CARTO Positron tiles, Jest + Testing Library.

Spec: `docs/superpowers/specs/2026-10-08-map-location-picker-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | modify | add `leaflet`, `react-leaflet`; dev `@types/leaflet`, `world-atlas`, `topojson-client`, `@types/topojson-client` |
| `scripts/build-europe-geo.cjs` | create | one-off generator → `public/geo/europe-countries.json` |
| `public/geo/europe-countries.json` | create (generated) | 32 country polygons, `properties.iso2` |
| `__tests__/public/europe-geo.test.ts` | create | asserts generated file covers exactly the 32 countries, all inside Europe |
| `lib/supabase/types.ts` | modify | `lat?`, `lng?` on `SearchLocation` |
| `components/search/cityHubSuggestions.ts` | modify | hubs become `{ name, lat, lng }` |
| `__tests__/components/search/cityHubSuggestions.test.ts` | create | every supported country has hubs with sane coords |
| `lib/geo/nominatim.ts` | create | `reverseGeocode`, `searchCity`, `GeoPlace` |
| `__tests__/lib/geo/nominatim.test.ts` | create | parsing + error handling, `fetch` mocked |
| `components/search/map/LocationMap.tsx` | create | Leaflet map UI (no logic beyond click routing) |
| `app/globals.css` | modify | country hover style |
| `components/search/steps/StepVilles.tsx` | rewrite | search box + map + slider list |
| `__tests__/components/search/steps/StepVilles.test.tsx` | rewrite | behaviour tests with map + nominatim mocked |
| `components/search/WizardModal.tsx` | modify | `max-w-2xl` on Villes step |
| `__tests__/components/search/WizardModal.test.tsx` | modify | mock `next/dynamic` + nominatim |
| `CLAUDE.md` | modify | document picker + regen command |

---

### Task 1: Dependencies + Europe GeoJSON

**Files:**
- Modify: `package.json`
- Create: `scripts/build-europe-geo.cjs`
- Create: `public/geo/europe-countries.json` (generated)
- Test: `__tests__/public/europe-geo.test.ts`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install leaflet@1.9.4 react-leaflet@5.0.0
npm install -D @types/leaflet@1.9.22 world-atlas@2.0.2 topojson-client@3.1.0 @types/topojson-client@3.1.5
```
Expected: `package.json` lists them, no peer-dependency errors.

- [ ] **Step 2: Write the failing test**

Create `__tests__/public/europe-geo.test.ts`:

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/public/europe-geo.test.ts`
Expected: FAIL — `ENOENT: no such file or directory ... europe-countries.json`

- [ ] **Step 4: Write the generator**

Create `scripts/build-europe-geo.cjs`:

```js
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
```

- [ ] **Step 5: Generate the file**

Run: `node scripts/build-europe-geo.cjs`
Expected: `Wrote 32 countries to ...public/geo/europe-countries.json` (file ~150–170 KB).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/public/europe-geo.test.ts`
Expected: PASS (2 tests). If the bounds test fails, print the offending iso2/point and tighten `EUROPE_BOX`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/build-europe-geo.cjs public/geo/europe-countries.json __tests__/public/europe-geo.test.ts
git commit -m "feat: add leaflet deps and Europe country borders GeoJSON"
```

---

### Task 2: `SearchLocation` coords + hub coordinates

**Files:**
- Modify: `lib/supabase/types.ts:55-59`
- Modify: `components/search/cityHubSuggestions.ts` (whole file)
- Test: `__tests__/components/search/cityHubSuggestions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/search/cityHubSuggestions.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/search/cityHubSuggestions.test.ts`
Expected: FAIL — `hub.name` undefined (hubs are still strings).

- [ ] **Step 3: Add coords to `SearchLocation`**

In `lib/supabase/types.ts` replace the interface:

```ts
export interface SearchLocation {
  ville: string
  rayon_km: number
  pays?: string // ISO2 country code, e.g. 'FR', 'DE', 'GB' (uppercase). Missing/undefined means 'FR'; legacy rows may hold lowercase, normalize case defensively when reading.
  lat?: number // city centre, set by the map picker; legacy rows may lack it (scrapers ignore it)
  lng?: number
}
```

- [ ] **Step 4: Rewrite `components/search/cityHubSuggestions.ts`**

```ts
export interface CityHub {
  name: string
  lat: number
  lng: number
}

// Domain-agnostic: the cities that concentrate office/tech hiring in a
// country are largely the same regardless of role (data, dev, security...).
// Shown as clickable markers once a country is selected on the map.
export const CITY_HUB_SUGGESTIONS: Record<string, CityHub[]> = {
  FR: [
    { name: 'Paris', lat: 48.857, lng: 2.352 },
    { name: 'Lyon', lat: 45.764, lng: 4.836 },
    { name: 'Toulouse', lat: 43.605, lng: 1.444 },
    { name: 'Lille', lat: 50.629, lng: 3.057 },
    { name: 'Nantes', lat: 47.218, lng: -1.554 },
  ],
  DE: [
    { name: 'Berlin', lat: 52.52, lng: 13.405 },
    { name: 'Munich', lat: 48.137, lng: 11.575 },
    { name: 'Hamburg', lat: 53.551, lng: 9.994 },
    { name: 'Frankfurt', lat: 50.111, lng: 8.682 },
  ],
  AT: [
    { name: 'Vienna', lat: 48.208, lng: 16.374 },
    { name: 'Graz', lat: 47.071, lng: 15.439 },
    { name: 'Linz', lat: 48.306, lng: 14.286 },
  ],
  BE: [
    { name: 'Brussels', lat: 50.85, lng: 4.352 },
    { name: 'Antwerp', lat: 51.219, lng: 4.402 },
    { name: 'Ghent', lat: 51.054, lng: 3.717 },
  ],
  BG: [
    { name: 'Sofia', lat: 42.698, lng: 23.322 },
    { name: 'Plovdiv', lat: 42.135, lng: 24.745 },
  ],
  CY: [
    { name: 'Nicosia', lat: 35.186, lng: 33.382 },
    { name: 'Limassol', lat: 34.707, lng: 33.022 },
  ],
  HR: [
    { name: 'Zagreb', lat: 45.815, lng: 15.982 },
    { name: 'Split', lat: 43.508, lng: 16.44 },
  ],
  DK: [
    { name: 'Copenhagen', lat: 55.676, lng: 12.568 },
    { name: 'Aarhus', lat: 56.163, lng: 10.204 },
  ],
  ES: [
    { name: 'Madrid', lat: 40.417, lng: -3.704 },
    { name: 'Barcelona', lat: 41.385, lng: 2.173 },
    { name: 'Valencia', lat: 39.47, lng: -0.376 },
    { name: 'Bilbao', lat: 43.263, lng: -2.935 },
  ],
  EE: [
    { name: 'Tallinn', lat: 59.437, lng: 24.754 },
    { name: 'Tartu', lat: 58.378, lng: 26.729 },
  ],
  FI: [
    { name: 'Helsinki', lat: 60.17, lng: 24.938 },
    { name: 'Tampere', lat: 61.498, lng: 23.761 },
    { name: 'Espoo', lat: 60.205, lng: 24.652 },
  ],
  GR: [
    { name: 'Athens', lat: 37.984, lng: 23.728 },
    { name: 'Thessaloniki', lat: 40.64, lng: 22.944 },
  ],
  HU: [
    { name: 'Budapest', lat: 47.498, lng: 19.04 },
    { name: 'Debrecen', lat: 47.532, lng: 21.627 },
  ],
  IE: [
    { name: 'Dublin', lat: 53.35, lng: -6.26 },
    { name: 'Cork', lat: 51.899, lng: -8.476 },
  ],
  IS: [{ name: 'Reykjavik', lat: 64.147, lng: -21.942 }],
  IT: [
    { name: 'Milan', lat: 45.464, lng: 9.19 },
    { name: 'Rome', lat: 41.903, lng: 12.496 },
    { name: 'Turin', lat: 45.07, lng: 7.687 },
    { name: 'Bologna', lat: 44.495, lng: 11.343 },
  ],
  LV: [{ name: 'Riga', lat: 56.95, lng: 24.105 }],
  LI: [{ name: 'Vaduz', lat: 47.141, lng: 9.521 }],
  LT: [
    { name: 'Vilnius', lat: 54.687, lng: 25.28 },
    { name: 'Kaunas', lat: 54.899, lng: 23.904 },
  ],
  LU: [{ name: 'Luxembourg', lat: 49.612, lng: 6.13 }],
  MT: [{ name: 'Valletta', lat: 35.899, lng: 14.514 }],
  NO: [
    { name: 'Oslo', lat: 59.914, lng: 10.752 },
    { name: 'Bergen', lat: 60.391, lng: 5.322 },
    { name: 'Trondheim', lat: 63.431, lng: 10.395 },
  ],
  NL: [
    { name: 'Amsterdam', lat: 52.368, lng: 4.904 },
    { name: 'Rotterdam', lat: 51.924, lng: 4.478 },
    { name: 'Utrecht', lat: 52.091, lng: 5.122 },
    { name: 'Eindhoven', lat: 51.441, lng: 5.47 },
  ],
  PL: [
    { name: 'Warsaw', lat: 52.23, lng: 21.012 },
    { name: 'Krakow', lat: 50.065, lng: 19.945 },
    { name: 'Wroclaw', lat: 51.108, lng: 17.039 },
    { name: 'Poznan', lat: 52.406, lng: 16.925 },
  ],
  PT: [
    { name: 'Lisbon', lat: 38.722, lng: -9.139 },
    { name: 'Porto', lat: 41.158, lng: -8.629 },
  ],
  CZ: [
    { name: 'Prague', lat: 50.076, lng: 14.438 },
    { name: 'Brno', lat: 49.195, lng: 16.607 },
  ],
  RO: [
    { name: 'Bucharest', lat: 44.427, lng: 26.103 },
    { name: 'Cluj-Napoca', lat: 46.771, lng: 23.624 },
  ],
  GB: [
    { name: 'London', lat: 51.507, lng: -0.128 },
    { name: 'Manchester', lat: 53.481, lng: -2.243 },
    { name: 'Edinburgh', lat: 55.953, lng: -3.188 },
    { name: 'Bristol', lat: 51.455, lng: -2.588 },
  ],
  SK: [
    { name: 'Bratislava', lat: 48.149, lng: 17.107 },
    { name: 'Kosice', lat: 48.717, lng: 21.261 },
  ],
  SI: [{ name: 'Ljubljana', lat: 46.057, lng: 14.506 }],
  SE: [
    { name: 'Stockholm', lat: 59.329, lng: 18.069 },
    { name: 'Gothenburg', lat: 57.709, lng: 11.975 },
    { name: 'Malmo', lat: 55.605, lng: 13.004 },
  ],
  CH: [
    { name: 'Zurich', lat: 47.377, lng: 8.541 },
    { name: 'Geneva', lat: 46.204, lng: 6.143 },
    { name: 'Basel', lat: 47.56, lng: 7.589 },
    { name: 'Zug', lat: 47.166, lng: 8.516 },
  ],
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/search/cityHubSuggestions.test.ts`
Expected: PASS.

Note: `npx tsc --noEmit` now fails in `StepVilles.tsx` (hubs no longer strings) — fixed in Task 5. Do not commit a `tsc` check yet.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/types.ts components/search/cityHubSuggestions.ts __tests__/components/search/cityHubSuggestions.test.ts
git commit -m "feat: add coordinates to city hubs and SearchLocation"
```

---

### Task 3: Nominatim client

**Files:**
- Create: `lib/geo/nominatim.ts`
- Test: `__tests__/lib/geo/nominatim.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/geo/nominatim.test.ts`:

```ts
import { reverseGeocode, searchCity } from '@/lib/geo/nominatim'

const mockFetch = jest.fn()
beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

const ok = (body: unknown) => ({ ok: true, json: async () => body })

describe('reverseGeocode', () => {
  it('returns the city name, uppercase country and numeric coords', async () => {
    mockFetch.mockResolvedValue(ok({ lat: '50.6365', lon: '3.0635', address: { city: 'Lille', country_code: 'fr' } }))
    await expect(reverseGeocode(50.63, 3.06)).resolves.toEqual({ ville: 'Lille', pays: 'FR', lat: 50.6365, lng: 3.0635 })
    const url = String(mockFetch.mock.calls[0][0])
    expect(url).toContain('/reverse?')
    expect(url).toContain('lat=50.63')
    expect(url).toContain('lon=3.06')
  })

  it('falls back to town then village', async () => {
    mockFetch.mockResolvedValue(ok({ lat: '1', lon: '2', address: { village: 'Bondues', country_code: 'fr' } }))
    await expect(reverseGeocode(1, 2)).resolves.toMatchObject({ ville: 'Bondues' })
  })

  it('returns null on a Nominatim error payload', async () => {
    mockFetch.mockResolvedValue(ok({ error: 'Unable to geocode' }))
    await expect(reverseGeocode(0, 0)).resolves.toBeNull()
  })

  it('returns null when the request fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    await expect(reverseGeocode(0, 0)).resolves.toBeNull()
  })
})

describe('searchCity', () => {
  it('restricts to the given countries and maps results', async () => {
    mockFetch.mockResolvedValue(ok([
      { lat: '45.76', lon: '4.83', name: 'Lyon', address: { city: 'Lyon', country_code: 'fr' } },
      { lat: '0', lon: '0', name: 'Nowhere', address: {} },
    ]))
    await expect(searchCity('Lyo', ['FR', 'DE'])).resolves.toEqual([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83 }])
    const url = String(mockFetch.mock.calls[0][0])
    expect(url).toContain('/search?')
    expect(url).toContain('q=Lyo')
    expect(url).toContain('countrycodes=fr%2Cde')
  })

  it('dedupes results with the same city and country', async () => {
    const lyon = { lat: '45.76', lon: '4.83', name: 'Lyon', address: { city: 'Lyon', country_code: 'fr' } }
    mockFetch.mockResolvedValue(ok([lyon, { ...lyon, lat: '45.7' }]))
    await expect(searchCity('Lyon', ['FR'])).resolves.toHaveLength(1)
  })

  it('returns [] when the request fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) })
    await expect(searchCity('Lyon', ['FR'])).resolves.toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/lib/geo/nominatim.test.ts`
Expected: FAIL — `Cannot find module '@/lib/geo/nominatim'`.

- [ ] **Step 3: Implement `lib/geo/nominatim.ts`**

```ts
// OpenStreetMap Nominatim geocoding, called from the browser by the map location
// picker. Free, no key; usage policy is max 1 req/s, so callers only hit it on
// explicit clicks or debounced typing.
// Names are requested in English to match CITY_HUB_SUGGESTIONS and what JSearch expects.

const BASE_URL = 'https://nominatim.openstreetmap.org'

export interface GeoPlace {
  ville: string
  pays: string // uppercase ISO2
  lat: number
  lng: number
}

interface NominatimResult {
  lat?: string
  lon?: string
  name?: string
  error?: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    country_code?: string
  }
}

function toPlace(r: NominatimResult): GeoPlace | null {
  const a = r.address ?? {}
  const ville = a.city ?? a.town ?? a.village ?? a.municipality ?? r.name
  const pays = a.country_code?.toUpperCase()
  const lat = Number(r.lat)
  const lng = Number(r.lon)
  if (!ville || !pays || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { ville, pays, lat, lng }
}

async function getJson<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const query = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', 'accept-language': 'en', ...params })
  try {
    const res = await fetch(`${BASE_URL}/${path}?${query}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** Nearest city/town/village to a clicked point (zoom 10 = city level). */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlace | null> {
  const data = await getJson<NominatimResult>('reverse', { lat: String(lat), lon: String(lng), zoom: '10' })
  if (!data || data.error) return null
  return toPlace(data)
}

/** Settlements matching `query`, restricted to the given ISO2 country codes. */
export async function searchCity(query: string, countryCodes: string[]): Promise<GeoPlace[]> {
  const data = await getJson<NominatimResult[]>('search', {
    q: query,
    countrycodes: countryCodes.join(',').toLowerCase(),
    featureType: 'settlement',
    limit: '5',
  })
  if (!Array.isArray(data)) return []
  const seen = new Set<string>()
  return data
    .map(toPlace)
    .filter((p): p is GeoPlace => {
      if (!p) return false
      const key = `${p.ville}|${p.pays}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/lib/geo/nominatim.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/geo/nominatim.ts __tests__/lib/geo/nominatim.test.ts
git commit -m "feat: add Nominatim geocoding client"
```

---

### Task 4: `LocationMap` component

Leaflet does not run in jsdom (no layout), so this component has no unit test; it is kept free of logic (it only routes clicks) and verified in the browser in Task 7. `StepVilles` tests mock it.

**Files:**
- Create: `components/search/map/LocationMap.tsx`
- Modify: `app/globals.css` (append)

- [ ] **Step 1: Create `components/search/map/LocationMap.tsx`**

```tsx
'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { Circle, CircleMarker, GeoJSON, MapContainer, Pane, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { LatLngBoundsExpression, LeafletMouseEvent, PathOptions, Polygon } from 'leaflet'
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson'
import type { SearchLocation } from '@/lib/supabase/types'
import type { GeoPlace } from '@/lib/geo/nominatim'
import { CITY_HUB_SUGGESTIONS } from '../cityHubSuggestions'

type CountryFeature = Feature<MultiPolygon, { iso2: string }>
type CountryCollection = FeatureCollection<MultiPolygon, { iso2: string }>

export interface LocationMapProps {
  locations: SearchLocation[]
  /** Map flies here when it changes (e.g. after a text-search pick). */
  focus: { lat: number; lng: number } | null
  /** A hub marker was clicked — place is already resolved, no geocoding needed. */
  onPick: (place: GeoPlace) => void
  /** Click inside the already-selected supported country — caller reverse-geocodes. */
  onPickPoint: (lat: number, lng: number) => void
  /** Click on sea / unsupported country. */
  onUnsupported: () => void
}

const EUROPE_BOUNDS: LatLngBoundsExpression = [[33, -27], [72, 46]]

// Leaflet writes colours as SVG attributes, where CSS var() does not resolve.
function readAccent(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6366f1'
}

// The wizard modal scales in with GSAP; Leaflet measures its container at mount,
// so re-measure once the animation is done.
function InvalidateSizeOnMount() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 300)
    return () => clearTimeout(t)
  }, [map])
  return null
}

function FlyToFocus({ focus }: { focus: LocationMapProps['focus'] }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 7), { duration: 0.6 })
  }, [focus, map])
  return null
}

function UnsupportedClicks({ onUnsupported }: { onUnsupported: () => void }) {
  // Country polygons and hub markers set bubblingMouseEvents=false, so this only
  // fires for clicks outside supported countries.
  useMapEvents({ click: () => onUnsupported() })
  return null
}

function CountriesLayer({
  geo, accent, selectedCountry, onSelectCountry, onPickPoint,
}: {
  geo: CountryCollection
  accent: string
  selectedCountry: string | null
  onSelectCountry: (iso2: string) => void
  onPickPoint: (lat: number, lng: number) => void
}) {
  const map = useMap()

  const style = (feature?: CountryFeature): PathOptions => ({
    className: 'europe-country',
    color: accent,
    weight: 1,
    fillColor: accent,
    fillOpacity: feature?.properties.iso2 === selectedCountry ? 0.18 : 0.06,
  })

  return (
    <GeoJSON
      data={geo}
      style={style as (f?: Feature) => PathOptions}
      bubblingMouseEvents={false}
      eventHandlers={{
        click: (e: LeafletMouseEvent) => {
          // GeoJSON is a FeatureGroup: the clicked country polygon is e.propagatedFrom.
          const layer = e.propagatedFrom as Polygon & { feature: CountryFeature }
          const iso2 = layer.feature.properties.iso2
          if (iso2 === selectedCountry) {
            onPickPoint(e.latlng.lat, e.latlng.lng)
          } else {
            onSelectCountry(iso2)
            map.fitBounds(layer.getBounds(), { padding: [16, 16] })
          }
        },
      }}
    />
  )
}

export function LocationMap({ locations, focus, onPick, onPickPoint, onUnsupported }: LocationMapProps) {
  const [geo, setGeo] = useState<CountryCollection | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [accent] = useState(readAccent)

  useEffect(() => {
    let cancelled = false
    fetch('/geo/europe-countries.json')
      .then(r => r.json() as Promise<CountryCollection>)
      .then(data => { if (!cancelled) setGeo(data) })
      .catch(() => { /* map still usable via search box + list */ })
    return () => { cancelled = true }
  }, [])

  const hubs = selectedCountry ? CITY_HUB_SUGGESTIONS[selectedCountry] ?? [] : []

  return (
    <MapContainer
      bounds={EUROPE_BOUNDS}
      maxBounds={EUROPE_BOUNDS}
      maxBoundsViscosity={1}
      minZoom={3}
      worldCopyJump={false}
      className="h-72 w-full rounded-xl z-0"
      style={{ border: '1px solid var(--border)' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <InvalidateSizeOnMount />
      <FlyToFocus focus={focus} />
      <UnsupportedClicks onUnsupported={onUnsupported} />

      {/* Below the default overlay pane (400) so circles and markers draw on top. */}
      <Pane name="countries" style={{ zIndex: 350 }}>
        {geo && (
          <CountriesLayer
            geo={geo}
            accent={accent}
            selectedCountry={selectedCountry}
            onSelectCountry={setSelectedCountry}
            onPickPoint={onPickPoint}
          />
        )}
      </Pane>

      {locations.filter(l => l.lat !== undefined && l.lng !== undefined).map(l => (
        <Circle
          key={`circle-${l.ville}|${l.pays}`}
          center={[l.lat!, l.lng!]}
          radius={l.rayon_km * 1000}
          interactive={false}
          pathOptions={{ color: accent, weight: 1.5, fillColor: accent, fillOpacity: 0.12 }}
        />
      ))}

      {hubs.map(hub => (
        <CircleMarker
          key={`hub-${hub.name}`}
          center={[hub.lat, hub.lng]}
          radius={6}
          bubblingMouseEvents={false}
          pathOptions={{ color: accent, weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
          eventHandlers={{
            click: () => onPick({ ville: hub.name, pays: selectedCountry!, lat: hub.lat, lng: hub.lng }),
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>{hub.name}</Tooltip>
        </CircleMarker>
      ))}

      {locations.filter(l => l.lat !== undefined && l.lng !== undefined).map(l => (
        <CircleMarker
          key={`dot-${l.ville}|${l.pays}`}
          center={[l.lat!, l.lng!]}
          radius={5}
          interactive={false}
          pathOptions={{ color: accent, weight: 2, fillColor: accent, fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -6]}>{l.ville}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
```

- [ ] **Step 2: Append hover style to `app/globals.css`**

```css
/* Map location picker — country hover. Leaflet sets fill-opacity as an SVG
   attribute; this CSS rule overrides it on hover only. */
.europe-country { cursor: pointer; transition: fill-opacity 120ms ease; }
.europe-country:hover { fill-opacity: 0.25; }
```

- [ ] **Step 3: Type-check the component**

Run: `npx tsc --noEmit 2>&1 | grep -v StepVilles`
Expected: no errors outside `StepVilles.tsx` (that file is rewritten in Task 5).

- [ ] **Step 4: Commit**

```bash
git add components/search/map/LocationMap.tsx app/globals.css
git commit -m "feat: add Leaflet LocationMap for the search wizard"
```

---

### Task 5: Rewrite `StepVilles`

**Files:**
- Rewrite: `components/search/steps/StepVilles.tsx`
- Rewrite: `__tests__/components/search/steps/StepVilles.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace `__tests__/components/search/steps/StepVilles.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepVilles } from '@/components/search/steps/StepVilles'
import { reverseGeocode, searchCity } from '@/lib/geo/nominatim'
import type { LocationMapProps } from '@/components/search/map/LocationMap'

// Leaflet can't run in jsdom: replace the dynamically-imported map with buttons
// that trigger each of its callbacks.
jest.mock('next/dynamic', () => () => {
  function MockLocationMap(props: LocationMapProps) {
    return (
      <div>
        <button type="button" onClick={() => props.onPick({ ville: 'Berlin', pays: 'DE', lat: 52.52, lng: 13.405 })}>pick-hub</button>
        <button type="button" onClick={() => props.onPickPoint(50.63, 3.06)}>pick-point</button>
        <button type="button" onClick={() => props.onUnsupported()}>pick-outside</button>
      </div>
    )
  }
  return MockLocationMap
})

jest.mock('@/lib/geo/nominatim', () => ({ reverseGeocode: jest.fn(), searchCity: jest.fn() }))
const mockReverse = reverseGeocode as jest.MockedFunction<typeof reverseGeocode>
const mockSearch = searchCity as jest.MockedFunction<typeof searchCity>

const lille = { ville: 'Lille', pays: 'FR', lat: 50.63, lng: 3.06, rayon_km: 30 }
const berlin = { ville: 'Berlin', pays: 'DE', lat: 52.52, lng: 13.405, rayon_km: 20 }

beforeEach(() => {
  mockReverse.mockReset()
  mockSearch.mockReset()
  mockSearch.mockResolvedValue([])
})

describe('StepVilles', () => {
  it('renders one row per location with country label and slider value', () => {
    render(<StepVilles value={[lille, berlin]} onChange={() => {}} />)
    expect(screen.getByText('Lille')).toBeInTheDocument()
    expect(screen.getByText('Allemagne')).toBeInTheDocument()
    expect(screen.getByLabelText('Rayon autour de Lille')).toHaveValue('30')
    expect(screen.getByText('20 km')).toBeInTheDocument()
  })

  it('updates rayon_km when the slider moves', () => {
    const onChange = jest.fn()
    render(<StepVilles value={[lille, berlin]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Rayon autour de Berlin'), { target: { value: '55' } })
    expect(onChange).toHaveBeenCalledWith([lille, { ...berlin, rayon_km: 55 }])
  })

  it('removes a row when its ✕ button is clicked', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[lille, berlin]} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Supprimer la ville Berlin'))
    expect(onChange).toHaveBeenCalledWith([lille])
  })

  it('adds a hub picked on the map with the default 30 km radius', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[lille]} onChange={onChange} />)
    await userEvent.click(screen.getByText('pick-hub'))
    expect(onChange).toHaveBeenCalledWith([lille, { ville: 'Berlin', pays: 'DE', lat: 52.52, lng: 13.405, rayon_km: 30 }])
  })

  it('ignores a city that is already selected', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[berlin]} onChange={onChange} />)
    await userEvent.click(screen.getByText('pick-hub'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reverse-geocodes a free click and adds the city', async () => {
    mockReverse.mockResolvedValue({ ville: 'Lille', pays: 'FR', lat: 50.63, lng: 3.06 })
    const onChange = jest.fn()
    render(<StepVilles value={[]} onChange={onChange} />)
    await userEvent.click(screen.getByText('pick-point'))
    expect(mockReverse).toHaveBeenCalledWith(50.63, 3.06)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([lille]))
  })

  it('shows a message when no city is found at the clicked point', async () => {
    mockReverse.mockResolvedValue(null)
    render(<StepVilles value={[]} onChange={() => {}} />)
    await userEvent.click(screen.getByText('pick-point'))
    expect(await screen.findByText('Ville introuvable à cet endroit')).toBeInTheDocument()
  })

  it('rejects a reverse-geocoded city in an unsupported country', async () => {
    mockReverse.mockResolvedValue({ ville: 'Belgrade', pays: 'RS', lat: 44.8, lng: 20.4 })
    const onChange = jest.fn()
    render(<StepVilles value={[]} onChange={onChange} />)
    await userEvent.click(screen.getByText('pick-point'))
    expect(await screen.findByText('Pays non couvert par la recherche')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows a message when clicking outside supported countries', async () => {
    render(<StepVilles value={[]} onChange={() => {}} />)
    await userEvent.click(screen.getByText('pick-outside'))
    expect(screen.getByText('Pays non couvert par la recherche')).toBeInTheDocument()
  })

  it('adds a city from the text search results', async () => {
    mockSearch.mockResolvedValue([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83 }])
    const onChange = jest.fn()
    render(<StepVilles value={[]} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('Rechercher une ville…'), 'Lyo')
    await userEvent.click(await screen.findByRole('button', { name: /Lyon/ }))
    expect(mockSearch).toHaveBeenCalledWith('Lyo', expect.arrayContaining(['FR', 'DE']))
    expect(onChange).toHaveBeenCalledWith([{ ville: 'Lyon', pays: 'FR', lat: 45.76, lng: 4.83, rayon_km: 30 }])
  })

  it('backfills coordinates for legacy locations without lat/lng', async () => {
    mockSearch.mockResolvedValue([{ ville: 'Lille', pays: 'FR', lat: 50.63, lng: 3.06 }])
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30 }]} onChange={onChange} />)
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([{ ville: 'Lille', rayon_km: 30, lat: 50.63, lng: 3.06 }])
    )
    expect(mockSearch).toHaveBeenCalledWith('Lille', ['FR'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepVilles.test.tsx`
Expected: FAIL — old component has no slider / `Rayon autour de …` label.

- [ ] **Step 3: Rewrite `components/search/steps/StepVilles.tsx`**

```tsx
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import type { SearchLocation } from '@/lib/supabase/types'
import { reverseGeocode, searchCity, type GeoPlace } from '@/lib/geo/nominatim'
import { inputClass } from '../wizardStyles'
import { EUROPE_COUNTRIES } from '../countries'

// Leaflet needs `window`: load the map on the client only.
const LocationMap = dynamic(() => import('../map/LocationMap').then(m => m.LocationMap), {
  ssr: false,
  loading: () => <div className="h-72 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />,
})

const COUNTRY_CODES = EUROPE_COUNTRIES.map(c => c.code)
const DEFAULT_RAYON_KM = 30
const MSG_UNSUPPORTED = 'Pays non couvert par la recherche'

const countryOf = (l: SearchLocation) => (l.pays ?? 'FR').toUpperCase()
const keyOf = (l: SearchLocation) => `${l.ville.toLowerCase()}|${countryOf(l)}`
const countryLabel = (code: string) => EUROPE_COUNTRIES.find(c => c.code === code)?.label ?? code

interface StepVillesProps {
  value: SearchLocation[]
  onChange: (value: SearchLocation[]) => void
}

export function StepVilles({ value, onChange }: StepVillesProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoPlace[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)

  // Async callbacks (geocoding) must merge into the latest value, not the one
  // captured when the request started.
  const valueRef = useRef(value)
  useEffect(() => { valueRef.current = value })

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchSeq = useRef(0)
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current) }, [])

  // Legacy profiles saved before the map have no coords: geocode them once so
  // their radius circle can be drawn. Silent on failure.
  useEffect(() => {
    const missing = value.filter(l => l.ville.trim() && (l.lat === undefined || l.lng === undefined))
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      const coords = new Map<string, { lat: number; lng: number }>()
      for (const l of missing) {
        const [hit] = await searchCity(l.ville, [countryOf(l)])
        if (hit) coords.set(keyOf(l), { lat: hit.lat, lng: hit.lng })
      }
      if (cancelled || coords.size === 0) return
      onChange(valueRef.current.map(l => {
        const c = coords.get(keyOf(l))
        return c && l.lat === undefined ? { ...l, ...c } : l
      }))
    })()
    return () => { cancelled = true }
    // Mount-only: later rows always come with coords from the picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addPlace = (place: GeoPlace) => {
    if (!COUNTRY_CODES.includes(place.pays)) {
      setMessage(MSG_UNSUPPORTED)
      return
    }
    setMessage(null)
    setFocus({ lat: place.lat, lng: place.lng })
    const current = valueRef.current
    if (current.some(l => keyOf(l) === keyOf(place))) return
    onChange([...current, { ...place, rayon_km: DEFAULT_RAYON_KM }])
  }

  const handlePickPoint = async (lat: number, lng: number) => {
    setMessage('Recherche de la ville…')
    const place = await reverseGeocode(lat, lng)
    if (!place) {
      setMessage('Ville introuvable à cet endroit')
      return
    }
    addPlace(place)
  }

  const handleQuery = (q: string) => {
    setQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      const seq = ++searchSeq.current
      const found = await searchCity(trimmed, COUNTRY_CODES)
      if (seq !== searchSeq.current) return // a newer search superseded this one
      setResults(found)
      setMessage(found.length === 0 ? 'Ville introuvable' : null)
    }, 400)
  }

  const pickResult = (place: GeoPlace) => {
    addPlace(place)
    setQuery('')
    setResults([])
  }

  const updateRow = (index: number, patch: Partial<SearchLocation>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium" style={{ color: 'var(--muted)' }}>Villes recherchées</label>

      <div className="relative">
        <input
          value={query}
          onChange={e => handleQuery(e.target.value)}
          placeholder="Rechercher une ville…"
          className={inputClass}
        />
        {results.length > 0 && (
          <ul
            className="absolute z-10 mt-1 w-full rounded-lg border shadow-md overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {results.map(r => (
              <li key={`${r.ville}|${r.pays}`}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-zinc-100"
                  style={{ color: 'var(--foreground)' }}
                >
                  {r.ville}
                  <span className="text-xs ml-1.5" style={{ color: 'var(--muted)' }}>{countryLabel(r.pays)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <LocationMap
        locations={value}
        focus={focus}
        onPick={addPlace}
        onPickPoint={handlePickPoint}
        onUnsupported={() => setMessage(MSG_UNSUPPORTED)}
      />
      <p className="text-xs" style={{ color: message ? 'var(--accent)' : 'var(--muted-light)' }} aria-live="polite">
        {message ?? 'Clique sur un pays pour zoomer, puis sur une ville (ou un point de la carte).'}
      </p>

      {value.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--muted-light)' }}>Aucune ville sélectionnée.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((row, index) => (
            <li
              key={`${keyOf(row)}|${index}`}
              className="rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {row.ville || 'Ville non renseignée'}
                  <span className="text-xs font-normal ml-1.5" style={{ color: 'var(--muted)' }}>{countryLabel(countryOf(row))}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  aria-label={`Supprimer la ville ${row.ville || index + 1}`}
                  className="text-xs px-2 py-1 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
                  style={{ color: 'var(--muted)' }}
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={row.rayon_km}
                  onChange={e => updateRow(index, { rayon_km: Number(e.target.value) })}
                  aria-label={`Rayon autour de ${row.ville}`}
                  className="flex-1"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="text-xs w-14 text-right" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {row.rayon_km} km
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs" style={{ color: 'var(--muted-light)' }}>
        Le rayon ne s&apos;applique qu&apos;aux offres françaises (APEC, France Travail, HelloWork) ; pour les autres pays, la recherche couvre tout le pays via JSearch et EURES.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepVilles.test.tsx`
Expected: PASS (11 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/search/steps/StepVilles.tsx __tests__/components/search/steps/StepVilles.test.tsx
git commit -m "feat: pick search cities on a map with radius sliders"
```

---

### Task 6: Wizard modal width + its tests

**Files:**
- Modify: `components/search/WizardModal.tsx:118`
- Modify: `__tests__/components/search/WizardModal.test.tsx` (top of file)

- [ ] **Step 1: Run the WizardModal tests to see the current state**

Run: `npx jest --no-coverage __tests__/components/search/WizardModal.test.tsx`
Expected: may fail or log errors because the real `next/dynamic` tries to load Leaflet + CSS in jsdom.

- [ ] **Step 2: Mock the map and geocoder in the WizardModal test**

Insert after the imports of `__tests__/components/search/WizardModal.test.tsx`:

```tsx
// The Villes step renders a Leaflet map (not runnable in jsdom) and geocodes legacy rows.
jest.mock('next/dynamic', () => () => function MockLocationMap() { return null })
jest.mock('@/lib/geo/nominatim', () => ({
  reverseGeocode: jest.fn().mockResolvedValue(null),
  searchCity: jest.fn().mockResolvedValue([]),
}))
```

- [ ] **Step 3: Widen the modal on the Villes step**

In `components/search/WizardModal.tsx` change the card class:

```tsx
        className={`w-full ${step === 1 ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl shadow-xl overflow-hidden`}
```

- [ ] **Step 4: Run the full suite + type-check + lint**

Run: `npx tsc --noEmit && npx jest --no-coverage && npm run lint`
Expected: tsc clean, all tests PASS, no new lint errors (warnings pre-existing elsewhere are fine).

- [ ] **Step 5: Commit**

```bash
git add components/search/WizardModal.tsx __tests__/components/search/WizardModal.test.tsx
git commit -m "feat: widen search wizard on the map step"
```

---

### Task 7: Browser verification + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the app and open the wizard**

Start the dev server via preview tooling (`.claude/launch.json`), sign in, go to `/search`, open "Nouveau profil", fill a name, go to step 2.

Check:
- Map shows Europe with tinted countries; hovering a country darkens it.
- Clicking France zooms to France (not to French Guiana) and shows 5 white hub markers.
- Clicking "Lyon" hub adds a row "Lyon France" with slider at 30 km and a circle on the map.
- Dragging the slider resizes the circle live.
- Clicking an empty spot inside France adds the nearest town (network call to `nominatim.openstreetmap.org/reverse`).
- Clicking the sea shows "Pays non couvert par la recherche".
- Typing "Porto" in the search box lists Porto (Portugal); picking it flies the map there.
- Editing an existing profile created before this change shows its cities with circles (backfill).
- No console errors; at mobile width (375px) map and sliders fit without horizontal scroll.

- [ ] **Step 2: Document in `CLAUDE.md`**

Under "Key Design Decisions", add:

```markdown
- **Map location picker** (`components/search/steps/StepVilles.tsx` + `components/search/map/LocationMap.tsx`): Leaflet/react-leaflet, loaded with `next/dynamic` `ssr:false`. Country borders come from `public/geo/europe-countries.json`, generated by `node scripts/build-europe-geo.cjs` (re-run if `components/search/countries.ts` changes). Geocoding = Nominatim from the browser (`lib/geo/nominatim.ts`, English names, ≤1 req/s). `SearchLocation.lat/lng` are optional (jsonb, no migration); legacy rows are geocoded on wizard open. Tests mock `next/dynamic` and `@/lib/geo/nominatim` — Leaflet can't run in jsdom.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document map location picker"
```
