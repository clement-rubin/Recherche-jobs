type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

const statusConfig: Record<string, { label: string; tone: Tone }> = {
  en_cours:     { label: 'En cours',     tone: 'accent' },
  relance:      { label: 'Relance',      tone: 'warning' },
  termine:      { label: 'Terminé',      tone: 'neutral' },
  accepte:      { label: 'Accepté',      tone: 'success' },
  refus:        { label: 'Refus',        tone: 'danger' },
  sans_reponse: { label: 'Sans réponse', tone: 'neutral' },
  non_traite:   { label: 'À traiter',    tone: 'accent' },
  ignore:       { label: 'Ignoré',       tone: 'neutral' },
  postule:      { label: 'Postulé',      tone: 'accent' },
  sauvegarde:   { label: 'Sauvegardé',   tone: 'success' },
}

const toneStyle: Record<Tone, React.CSSProperties> = {
  accent:  { background: 'var(--accent-surface)',  color: 'var(--accent-text)',  borderColor: 'var(--accent-border)' },
  success: { background: 'var(--success-surface)', color: 'var(--success-text)', borderColor: 'var(--success-border)' },
  warning: { background: 'var(--warning-surface)', color: 'var(--warning-text)', borderColor: 'var(--warning-border)' },
  danger:  { background: 'var(--danger-surface)',  color: 'var(--danger-text)',  borderColor: 'var(--danger-border)' },
  neutral: { background: 'var(--surface)',         color: 'var(--muted)',        borderColor: 'var(--border)' },
}

export function Badge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, tone: 'neutral' as Tone }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-sm)] text-xs font-medium border"
      style={toneStyle[config.tone]}
    >
      {config.label}
    </span>
  )
}
