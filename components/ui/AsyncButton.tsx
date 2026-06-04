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
  variant?: 'primary' | 'secondary'
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

  const baseClass = variant === 'primary'
    ? 'text-white font-semibold rounded-lg px-4 py-2 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed'
    : 'border border-zinc-200 text-zinc-600 rounded-lg px-4 py-2 text-sm transition-all hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed'

  const stateClass = {
    idle: variant === 'primary' ? 'bg-indigo-500 hover:bg-indigo-600' : '',
    loading: variant === 'primary' ? 'bg-indigo-400' : '',
    success: variant === 'primary' ? 'bg-green-600' : 'text-green-600 border-green-200',
    error: variant === 'primary' ? 'bg-red-500' : 'text-red-500 border-red-200',
  }

  const label: Record<BtnState, React.ReactNode> = {
    idle: children,
    loading: loadingLabel,
    success: successLabel,
    error: errorLabel,
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={`${baseClass} ${stateClass[state]} ${className}`}
    >
      {label[state]}
    </button>
  )
}
