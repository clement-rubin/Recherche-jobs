'use client'

import { TagInput } from '@/components/ui/TagInput'
import { DOMAIN_SUGGESTIONS } from '../domainSuggestions'

interface StepQualificationsProps {
  value: string[]
  onChange: (value: string[]) => void
  domaineKey: string
}

export function StepQualifications({ value, onChange, domaineKey }: StepQualificationsProps) {
  const suggestions = DOMAIN_SUGGESTIONS[domaineKey]?.qualifications ?? []
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Qualifications</label>
      <TagInput
        value={value}
        onChange={onChange}
        suggestions={suggestions}
        placeholder="Ex: AWS, TensorFlow, Bac+5..."
        tagColor="blue"
      />
    </div>
  )
}
