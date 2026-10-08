import type { Niveau } from '@/lib/analysis/types'

const STYLES: Record<Niveau, { label: string; color: string; bg: string }> = {
  haute:   { label: 'Haute',   color: 'var(--success)', bg: 'rgba(22,163,74,0.1)' },
  moyenne: { label: 'Moyenne', color: 'var(--accent)',  bg: 'var(--accent-dim)' },
  basse:   { label: 'Basse',   color: 'var(--muted)',   bg: 'var(--background)' },
  expiree: { label: 'Expirée', color: 'var(--danger)',  bg: 'rgba(239,68,68,0.08)' },
}

export function PriorityBadge({ niveau, score }: { niveau: Niveau; score: number }) {
  const s = STYLES[niveau]
  return (
    <span
      role="img"
      aria-label={niveau === 'expiree' ? `Priorité ${s.label}` : `Priorité ${s.label}, ${score}`}
      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border"
      style={{ color: s.color, background: s.bg, borderColor: s.color }}
    >
      {niveau === 'expiree' ? s.label : `${s.label} · ${score}`}
    </span>
  )
}
