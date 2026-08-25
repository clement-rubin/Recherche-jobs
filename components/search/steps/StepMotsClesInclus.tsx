'use client'

import { useState } from 'react'
import { TagInput } from '@/components/ui/TagInput'
import { DOMAIN_SUGGESTIONS } from '../domainSuggestions'

interface StepMotsClesInclusProps {
  value: string[]
  onChange: (value: string[]) => void
  domaineKey: string
  conflictsWith: string[]
}

export function StepMotsClesInclus({ value, onChange, domaineKey, conflictsWith }: StepMotsClesInclusProps) {
  const [error, setError] = useState<string | null>(null)
  const suggestions = DOMAIN_SUGGESTIONS[domaineKey]?.motsCles ?? []

  const handleChange = (newTags: string[]) => {
    if (newTags.length > value.length) {
      const added = newTags[newTags.length - 1]
      if (conflictsWith.includes(added)) {
        setError(`"${added}" est déjà dans les mots-clés à exclure`)
        return
      }
    }
    setError(null)
    onChange(newTags)
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Mots-clés à inclure</label>
      <p className="text-xs mb-2" style={{ color: 'var(--muted-light)' }}>
        Pensez aux variantes de titre de poste, outils, technologies.
      </p>
      <TagInput
        value={value}
        onChange={handleChange}
        suggestions={suggestions}
        placeholder="Tapez + Entrée ou virgule..."
        tagColor="indigo"
      />
      {error && <p className="text-xs mt-1.5 text-red-500">{error}</p>}
    </div>
  )
}
