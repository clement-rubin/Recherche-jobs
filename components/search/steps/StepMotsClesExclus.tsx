'use client'

import { useState } from 'react'
import { TagInput } from '@/components/ui/TagInput'
import { DOMAIN_SUGGESTIONS } from '../domainSuggestions'

const EXCLUSION_PRESETS = [
  { label: 'CDI', value: 'cdi' },
  { label: 'CDD', value: 'cdd' },
  { label: 'Alternance', value: 'alternance' },
  { label: 'Stage', value: 'stage' },
  { label: 'Freelance', value: 'freelance' },
  { label: 'Temps plein', value: 'temps plein' },
  { label: 'Temps partiel', value: 'temps partiel' },
]

interface StepMotsClesExclusProps {
  value: string[]
  onChange: (value: string[]) => void
  domaineKey: string
  conflictsWith: string[]
}

export function StepMotsClesExclus({ value, onChange, domaineKey, conflictsWith }: StepMotsClesExclusProps) {
  const [error, setError] = useState<string | null>(null)
  const suggestions = DOMAIN_SUGGESTIONS[domaineKey]?.exclusions ?? []

  const togglePreset = (presetValue: string) => {
    const active = value.includes(presetValue)
    if (active) {
      setError(null)
      onChange(value.filter(k => k !== presetValue))
      return
    }
    if (conflictsWith.includes(presetValue)) {
      setError(`"${presetValue}" est déjà dans les mots-clés à inclure`)
      return
    }
    setError(null)
    onChange([...value, presetValue])
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
        Mots-clés à exclure
        <span className="ml-1.5 font-normal" style={{ color: 'var(--muted-light)' }}>(offres contenant ces mots seront ignorées)</span>
      </label>
      <TagInput
        value={value}
        onChange={newTags => { setError(null); onChange(newTags) }}
        suggestions={suggestions}
        placeholder="Ex: cadre, senior, 5 ans d'expérience..."
        tagColor="blue"
        validateAdd={tag => !conflictsWith.includes(tag)}
        onRejected={tag => setError(`"${tag}" est déjà dans les mots-clés à inclure`)}
      />
      {error && <p className="text-xs mt-1.5 text-red-500">{error}</p>}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-xs" style={{ color: 'var(--muted-light)' }}>Ajouter :</span>
        {EXCLUSION_PRESETS.map(({ label, value: presetValue }) => {
          const active = value.includes(presetValue)
          return (
            <button
              key={presetValue}
              type="button"
              onClick={() => togglePreset(presetValue)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${active ? 'ring-1 ring-offset-1' : ''}`}
              style={
                active
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff', outlineColor: 'var(--accent)' }
                  : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }
              }
            >
              {active ? '✕ ' : '+ '}{label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
