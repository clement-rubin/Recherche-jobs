'use client'

import { useEffect } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  /** Bottom-sheet on mobile, centered card from `sm` up. Default true. */
  sheetOnMobile?: boolean
  className?: string
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  sheetOnMobile = true,
  className = '',
}: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const shape = sheetOnMobile
    ? 'rounded-t-[var(--r-2xl)] sm:rounded-[var(--r-2xl)] self-end sm:self-center'
    : 'rounded-[var(--r-2xl)] self-center'

  return (
    <div
      data-testid="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-50 flex justify-center bg-black/40 p-0 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full sm:max-w-lg flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden ${shape} ${className}`}
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
      >
        <div
          className="flex items-center justify-between px-5 sm:px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-[var(--r-md)] flex items-center justify-center transition-colors flex-shrink-0"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">{children}</div>

        {footer && (
          <div
            className="flex gap-3 px-5 sm:px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
