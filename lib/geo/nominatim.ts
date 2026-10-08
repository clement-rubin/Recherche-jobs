// OpenStreetMap Nominatim geocoding, called from the browser by the map location
// picker. Free, no key; usage policy is max 1 req/s and no autocomplete, so callers
// only hit it on explicit actions (map click, Enter / "Rechercher") or throttled.
// City-name language depends on the country:
// - France: French name ("Dunkerque", not "Dunkirk") — the French scrapers
//   (France Travail commune lookup, APEC, HelloWork) match on French names.
// - Elsewhere: English name when OSM has one ("Munich", "Vienna"), matching
//   CITY_HUB_SUGGESTIONS and what JSearch expects; else the local address name.

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
  namedetails?: Record<string, string>
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    country_code?: string
  }
}

/**
 * `allowNameFallback`: use the result's own `name` when the address has no
 * settlement. Only safe for settlement searches — on reverse lookups `name` can
 * be a county or arrondissement.
 */
function toPlace(r: NominatimResult, allowNameFallback: boolean): GeoPlace | null {
  const a = r.address ?? {}
  const local = a.city ?? a.town ?? a.village ?? a.municipality ?? (allowNameFallback ? r.name : undefined)
  const pays = a.country_code?.toUpperCase()
  const lat = Number(r.lat)
  const lng = Number(r.lon)
  if (!local || !pays || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const english = pays !== 'FR' ? r.namedetails?.['name:en'] : undefined
  return { ville: english || local, pays, lat, lng }
}

async function getJson<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const query = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    namedetails: '1',
    'accept-language': 'fr',
    ...params,
  })
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
  return toPlace(data, false)
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
    .map(r => toPlace(r, true))
    .filter((p): p is GeoPlace => {
      if (!p) return false
      const key = `${p.ville}|${p.pays}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
