'use client'

import { inputClass } from '../wizardStyles'
import { DOMAIN_OPTIONS } from '../domainSuggestions'

interface StepIdentiteProps {
  nom: string
  domaineKey: string
  domaineAutre: string
  onChange: (patch: Partial<{ nom: string; domaineKey: string; domaineAutre: string }>) => void
}

export function StepIdentite({ nom, domaineKey, domaineAutre, onChange }: StepIdentiteProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Nom du profil</label>
        <input
          value={nom}
          onChange={e => onChange({ nom: e.target.value })}
          placeholder="Ex: Data/IA Lille 2026"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Domaine</label>
        <select
          value={domaineKey}
          onChange={e => onChange({ domaineKey: e.target.value })}
          className={inputClass}
        >
          {DOMAIN_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {domaineKey === 'autre' && (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Précisez le domaine</label>
          <input
            value={domaineAutre}
            onChange={e => onChange({ domaineAutre: e.target.value })}
            placeholder="Ex: Community management"
            className={inputClass}
          />
        </div>
      )}
    </div>
  )
}
