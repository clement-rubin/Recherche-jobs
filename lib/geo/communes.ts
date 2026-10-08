// INSEE commune code lookup via geo.api.gouv.fr (free, no key). Called server-side
// by /api/jobs/fetch so France Travail can search `commune` + `distance` (radius).
// Coords (set by the map picker) are preferred; legacy rows fall back to the name.

const BASE_URL = 'https://geo.api.gouv.fr/communes'
const TIMEOUT_MS = 5000

// France Travail expects an arrondissement code for Paris/Lyon/Marseille, not the city code
const PLM_ARRONDISSEMENT: Record<string, string> = {
  '75056': '75101', // Paris
  '69123': '69381', // Lyon
  '13055': '13201', // Marseille
}

// Successes only — a failed lookup is retried on the next search
const cache = new Map<string, string>()

export async function resolveCommuneCode(loc: { ville: string; lat?: number; lng?: number }): Promise<string | null> {
  const hasCoords = typeof loc.lat === 'number' && typeof loc.lng === 'number'
  const key = hasCoords ? `${loc.lat},${loc.lng}` : loc.ville.trim().toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const params = new URLSearchParams(
    hasCoords
      ? { lat: String(loc.lat), lon: String(loc.lng), fields: 'code,nom', format: 'json' }
      : { nom: loc.ville.trim(), fields: 'code,nom', boost: 'population', limit: '1', format: 'json' }
  )

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE_URL}?${params}`, { signal: controller.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { code?: string }[]
    const raw = Array.isArray(data) ? data[0]?.code : undefined
    if (!raw) return null
    const code = PLM_ARRONDISSEMENT[raw] ?? raw
    cache.set(key, code)
    return code
  } catch (err) {
    console.warn('[geo/communes] lookup error', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}
