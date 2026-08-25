'use client'

import type { SearchProfile } from '@/lib/supabase/types'
import { inputClass } from '../wizardStyles'

const CONTRACT_TYPES = ['interim', 'stage', 'cdi', 'cdd', 'alternance']
const DUREE_GROUPS = [
  {
    label: 'Court terme',
    options: [
      { value: '1_semaine', label: '1 semaine' },
      { value: '2_semaines', label: '2 semaines' },
      { value: '3_semaines', label: '3 semaines' },
      { value: 'moins_1_mois', label: 'Moins de 1 mois' },
    ],
  },
  {
    label: 'Moyen terme',
    options: [
      { value: '1_3_mois', label: '1 à 3 mois' },
      { value: '3_6_mois', label: '3 à 6 mois' },
    ],
  },
  {
    label: 'Long terme',
    options: [{ value: '6_plus', label: '6 mois et plus' }],
  },
]

interface StepContratProps {
  typeContrat: string[]
  dureeContrat: SearchProfile['duree_contrat']
  salaireMin: number | ''
  onChange: (patch: Partial<{ type_contrat: string[]; duree_contrat: SearchProfile['duree_contrat']; salaire_min: number | '' }>) => void
}

export function StepContrat({ typeContrat, dureeContrat, salaireMin, onChange }: StepContratProps) {
  const toggleContract = (ct: string) => {
    onChange({
      type_contrat: typeContrat.includes(ct)
        ? typeContrat.filter(c => c !== ct)
        : [...typeContrat, ct],
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Types de contrat</label>
        <div className="flex flex-wrap gap-2">
          {CONTRACT_TYPES.map(ct => (
            <button
              key={ct}
              type="button"
              onClick={() => toggleContract(ct)}
              className="px-3 py-1 rounded-full text-xs border transition-colors capitalize"
              style={
                typeContrat.includes(ct)
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                  : { borderColor: 'var(--border)', color: 'var(--muted)' }
              }
            >
              {ct}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Durée de contrat</label>
          <select
            value={dureeContrat ?? 'peu_importe'}
            onChange={e => onChange({ duree_contrat: e.target.value as SearchProfile['duree_contrat'] })}
            className={inputClass}
          >
            <option value="peu_importe">Peu importe</option>
            {DUREE_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Salaire min (€/mois)</label>
          <input
            type="number"
            value={salaireMin}
            onChange={e => onChange({ salaire_min: e.target.value === '' ? '' : Number(e.target.value) })}
            placeholder="1500"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  )
}
