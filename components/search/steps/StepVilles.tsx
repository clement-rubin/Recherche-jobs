'use client'

import { useState } from 'react'
import type { SearchLocation } from '@/lib/supabase/types'
import { inputClass } from '../wizardStyles'

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
    onChange([...value, { ville: '', rayon_km: 30 }])
    setIds(prev => [...prev, crypto.randomUUID()])
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium" style={{ color: 'var(--muted)' }}>Villes recherchées</label>
      {value.map((row, index) => (
        <div key={ids[index] ?? index} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
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
      ))}
      <button
        type="button"
        onClick={addRow}
        className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
      >
        + Ajouter une ville
      </button>
    </div>
  )
}
