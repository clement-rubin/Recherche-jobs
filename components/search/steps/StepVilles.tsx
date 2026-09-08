'use client'

import { useState } from 'react'
import type { SearchLocation } from '@/lib/supabase/types'
import { inputClass } from '../wizardStyles'
import { EUROPE_COUNTRIES } from '../countries'
import { CITY_HUB_SUGGESTIONS } from '../cityHubSuggestions'

interface StepVillesProps {
  value: SearchLocation[]
  onChange: (value: SearchLocation[]) => void
}

export function StepVilles({ value, onChange }: StepVillesProps) {
  const [ids, setIds] = useState<string[]>(() => value.map(() => crypto.randomUUID()))

  const updateRow = (index: number, patch: Partial<SearchLocation>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    setIds(prev => prev.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onChange([...value, { ville: '', rayon_km: 30, pays: 'FR' }])
    setIds(prev => [...prev, crypto.randomUUID()])
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium" style={{ color: 'var(--muted)' }}>Villes recherchées</label>
      {value.map((row, index) => {
        const cityHubs = CITY_HUB_SUGGESTIONS[(row.pays ?? 'FR').toUpperCase()] ?? []
        return (
          <div key={ids[index] ?? index} className="space-y-1.5">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted-light)' }}>Ville</label>
                <input
                  value={row.ville}
                  onChange={e => updateRow(index, { ville: e.target.value })}
                  placeholder="Lille"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted-light)' }}>Pays</label>
                <select
                  value={(row.pays ?? 'FR').toUpperCase()}
                  onChange={e => updateRow(index, { pays: e.target.value })}
                  className={`${inputClass} w-40`}
                >
                  {EUROPE_COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted-light)' }}>Rayon (km)</label>
                <input
                  type="number" min="0" max="100"
                  value={row.rayon_km}
                  onChange={e => updateRow(index, { rayon_km: Math.min(100, Math.max(0, Number(e.target.value))) })}
                  className={`${inputClass} w-24`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label={`Supprimer la ville ${row.ville || index + 1}`}
                className="text-xs px-2 py-2 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
                style={{ color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>
            {cityHubs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cityHubs.map(city => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => updateRow(index, { ville: city })}
                    className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={addRow}
        className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
      >
        + Ajouter une ville
      </button>
      <p className="text-xs" style={{ color: 'var(--muted-light)' }}>
        Le rayon ne s&apos;applique qu&apos;aux offres françaises (APEC, France Travail, HelloWork) ; pour les autres pays, la recherche couvre tout le pays via JSearch et EURES.
      </p>
    </div>
  )
}
