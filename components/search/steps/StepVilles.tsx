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
const MIN_RAYON_KM = 0
const MAX_RAYON_KM = 100
// Nominatim usage policy: max 1 request/second.
const NOMINATIM_SPACING_MS = 1100
const MSG_UNSUPPORTED = 'Pays non couvert par la recherche'

type Place = Pick<SearchLocation, 'ville' | 'pays'>
const countryOf = (l: Place) => (l.pays ?? 'FR').toUpperCase()
const keyOf = (l: Place) => `${l.ville.toLowerCase()}|${countryOf(l)}`
const countryLabel = (code: string) => EUROPE_COUNTRIES.find(c => c.code === code)?.label ?? code
// Legacy rows may hold a radius outside the slider range: clamp for display only.
const clampRayon = (km: number) => Math.min(MAX_RAYON_KM, Math.max(MIN_RAYON_KM, km))
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

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

  // Bumped to invalidate any in-flight search (query edited, result picked).
  const searchSeq = useRef(0)
  const cancelSearch = () => { searchSeq.current++ }

  // Legacy profiles saved before the map have no coords: geocode them once so
  // their radius circle can be drawn. Throttled to Nominatim's 1 req/s; silent on failure.
  useEffect(() => {
    const missing = value.filter(l => l.ville.trim() && (l.lat === undefined || l.lng === undefined))
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      const coords = new Map<string, { lat: number; lng: number }>()
      for (let i = 0; i < missing.length; i++) {
        if (i > 0) await sleep(NOMINATIM_SPACING_MS)
        if (cancelled) return
        const l = missing[i]
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
    cancelSearch()
    setResults([])
  }

  // Explicit search only (Enter / button): Nominatim's usage policy forbids
  // search-as-you-type, and it doesn't prefix-match anyway.
  const runSearch = async () => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    const seq = ++searchSeq.current
    const found = await searchCity(trimmed, COUNTRY_CODES)
    if (seq !== searchSeq.current) return // query edited or a newer search started
    setResults(found)
    setMessage(found.length === 0 ? 'Ville introuvable' : null)
  }

  const pickResult = (place: GeoPlace) => {
    cancelSearch()
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
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => handleQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return
              e.preventDefault() // never submit a surrounding form
              void runSearch()
            }}
            placeholder="Rechercher une ville…"
            className={`${inputClass} flex-1 min-w-0`}
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            className="shrink-0 px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-zinc-50"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Rechercher
          </button>
        </div>
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
                  min={MIN_RAYON_KM}
                  max={MAX_RAYON_KM}
                  step={5}
                  value={clampRayon(row.rayon_km)}
                  onChange={e => updateRow(index, { rayon_km: Number(e.target.value) })}
                  aria-label={`Rayon autour de ${row.ville}`}
                  className="flex-1"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="text-xs w-14 text-right" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {clampRayon(row.rayon_km)} km
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
