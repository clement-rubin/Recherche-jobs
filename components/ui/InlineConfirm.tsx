'use client'

import { useEffect } from 'react'

interface InlineConfirmProps {
  visible: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
}

export function InlineConfirm({
  visible,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
}: InlineConfirmProps) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onCancel, 5000)
    return () => clearTimeout(timer)
  }, [visible, onCancel])

  if (!visible) return null

  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <span className="flex-1 text-sm text-red-700">{message}</span>
      <button
        onClick={onConfirm}
        className="text-xs font-semibold text-red-600 border border-red-300 rounded-md px-3 py-1 hover:bg-red-100 transition-colors"
      >
        {confirmLabel}
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-zinc-500 border border-zinc-200 rounded-md px-3 py-1 hover:bg-zinc-100 transition-colors"
      >
        {cancelLabel}
      </button>
    </div>
  )
}
