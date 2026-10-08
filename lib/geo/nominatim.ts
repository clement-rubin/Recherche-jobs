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
