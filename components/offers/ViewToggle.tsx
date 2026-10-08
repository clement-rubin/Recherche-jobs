'use client'

type ViewMode = 'list' | 'swipe'

interface Props {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewToggle({ mode, onChange }: Props) {
  return (
    <div
      className="flex rounded-[var(--r-lg)] overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
    >
      {(['list', 'swipe'] as ViewMode[]).map((m) => {
        const active = mode === m
        return (
          <button
            key={m}
            aria-pressed={active}
            onClick={() => onChange(m)}
            className="px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--muted)',
            }}
          >
            {m === 'list' ? 'Liste' : 'Swipe'}
          </button>
        )
      })}
    </div>
  )
}
