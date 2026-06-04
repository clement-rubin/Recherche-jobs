'use client'

import { useState, useRef } from 'react'
import { gsap } from 'gsap'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  tagColor?: 'indigo' | 'blue'
  className?: string
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Tapez + Entrée...',
  tagColor = 'indigo',
  className = '',
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const tagStyles = {
    indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
  }

  const addTag = (tag: string) => {
    const trimmed = tag.trim().replace(/,$/, '').trim()
    if (!trimmed || value.includes(trimmed)) return
    const newTags = [...value, trimmed]
    onChange(newTags)
    setInputValue('')
    // Animate new tag in
    requestAnimationFrame(() => {
      const lastTag = containerRef.current?.querySelector('[data-tag]:last-of-type')
      if (lastTag) gsap.from(lastTag, { scale: 0.7, opacity: 0, duration: 0.15, ease: 'back.out(1.7)' })
    })
  }

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    }
    if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (v.endsWith(',')) {
      addTag(v)
    } else {
      setInputValue(v)
    }
  }

  const visibleSuggestions = suggestions.filter(s => !value.includes(s))

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="flex flex-wrap gap-1.5 min-h-[38px] items-center p-1.5 bg-[#fafafa] border border-zinc-200 rounded-lg focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
      >
        {value.map(tag => (
          <span
            key={tag}
            data-tag
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${tagStyles[tagColor]}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Supprimer ${tag}`}
              className="opacity-40 hover:opacity-80 transition-opacity ml-0.5 text-sm leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
        />
      </div>
      {visibleSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-xs text-zinc-400 self-center">Suggestions :</span>
          {visibleSuggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="text-xs border border-dashed border-indigo-200 text-indigo-500 rounded px-2 py-0.5 hover:bg-indigo-50 transition-colors"
            >
              <span aria-hidden="true">+ </span>{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
