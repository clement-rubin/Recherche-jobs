'use client'

import { useState } from 'react'

type BtnState = 'idle' | 'loading' | 'success' | 'error'

interface AsyncButtonProps {
  onClick: () => Promise<void>
  children: React.ReactNode
  loadingLabel?: string
  successLabel?: string
  errorLabel?: string
  className?: string
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function AsyncButton({
  onClick,
  children,
  loadingLabel = 'Chargement...',
  successLabel = '✓ Succès',
  errorLabel = '✕ Erreur',
  className = '',
  disabled = false,
  variant = 'primary',
}: AsyncButtonProps) {
  const [state, setState] = useState<BtnState>('idle')

  const handleClick = async () => {
    if (state !== 'idle') return
    setState('loading')
    try {
      await onClick()
      setState('success')
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const baseClass =
    'font-semibold rounded-[var(--r-lg)] px-4 py-2 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed min-h-[40px]'

  const variantStyle: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--accent)', color: '#fff', border: '1px solid transparent' },
    secondary: { background: 'var(--card)', color: 'var(--foreground-dim)', border: '1px solid var(--border)' },
    ghost:     { background: 'transparent', color: 'var(--muted)', border: '1px solid transparent' },
    danger:    { background: 'var(--danger-surface)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)' },
  }

  const stateStyle: Partial<Record<BtnState, React.CSSProperties>> = {
    loading: { opacity: 0.75 },
    success: { background: 'var(--success-surface)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
    error:   { background: 'var(--danger-surface)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)' },
  }

  const label: Record<BtnState, React.ReactNode> = {
    idle: children,
    loading: (
      <span className="flex items-center gap-2 justify-center">
        <span aria-hidden="true" className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block" />
        {loadingLabel}
      </span>
    ),
    success: successLabel,
    error: errorLabel,
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={`${baseClass} ${className}`}
      style={{ ...variantStyle[variant], ...(stateStyle[state] ?? {}) }}
    >
      {label[state]}
    </button>
  )
}
