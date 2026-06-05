'use client'

import { useRef, useCallback, useEffect } from 'react'
import gsap from 'gsap'
import type { Offer } from '@/lib/supabase/types'

const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  apec: 'APEC',
  hellowork: 'HelloWork',
  france_travail: 'France Travail',
  email: 'Email',
}

const THRESHOLD = 120

type Action = 'postule' | 'ignore' | 'sauvegarde'
type SwipeDirection = 'right' | 'left' | 'up' | null

interface Props {
  offer: Offer
  onAction: (id: string, action: Action) => Promise<void>
  stackIndex: number
}

function getDescription(offer: Offer): string {
  if (!offer.raw_data) return ''
  const d = offer.raw_data
  return (d.description as string) || (d.job_description as string) || ''
}

function getDuration(offer: Offer): string | null {
  if (!offer.raw_data) return null
  const d = offer.raw_data
  return (d.duree as string) || (d.duration as string) || null
}

function getStackStyle(stackIndex: number): React.CSSProperties {
  if (stackIndex === 1) return { transform: 'rotate(3deg) scale(0.97)', zIndex: 2 }
  if (stackIndex === 2) return { transform: 'rotate(6deg) scale(0.94)', zIndex: 1 }
  return { transform: 'rotate(0deg) scale(1)', zIndex: 3 }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function SwipeCard({ offer, onAction, stackIndex }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, x: 0, y: 0 })
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const card = cardRef.current
    return () => {
      if (card) gsap.killTweensOf(card)
    }
  }, [])

  const getDirection = useCallback((x: number, y: number): SwipeDirection => {
    const absX = Math.abs(x)
    const absY = Math.abs(y)
    if (y < -THRESHOLD * 0.5 && absY > absX) return 'up'
    if (x > THRESHOLD) return 'right'
    if (x < -THRESHOLD) return 'left'
    return null
  }, [])

  const getOverlayColor = (dir: SwipeDirection) => {
    if (dir === 'right') return 'rgba(34,197,94,0.25)'
    if (dir === 'left') return 'rgba(239,68,68,0.25)'
    if (dir === 'up') return 'rgba(250,204,21,0.2)'
    return 'transparent'
  }

  const getOverlayContent = (dir: SwipeDirection) => {
    if (dir === 'right') return { icon: '✓', label: 'POSTULER', color: '#4ade80' }
    if (dir === 'left') return { icon: '✕', label: 'IGNORER', color: '#f87171' }
    if (dir === 'up') return { icon: '⭐', label: 'SAUVEGARDER', color: '#fbbf24' }
    return null
  }

  const fireAction = useCallback(async (action: Action) => {
    await onAction(offer.id, action)
  }, [offer.id, onAction])

  const flyOut = useCallback((dir: SwipeDirection, action: Action) => {
    if (!cardRef.current) return
    dragState.current.dragging = false
    gsap.killTweensOf(cardRef.current)
    if (reducedMotion.current) {
      fireAction(action)
      return
    }
    const x = dir === 'right' ? 600 : dir === 'left' ? -600 : 0
    const y = dir === 'up' ? -600 : 0
    const rotation = dir === 'right' ? 30 : dir === 'left' ? -30 : 0
    gsap.to(cardRef.current, {
      x, y, rotation, opacity: 0,
      duration: 0.35, ease: 'power2.in',
      onComplete: () => fireAction(action),
    })
  }, [fireAction])

  const springBack = useCallback(() => {
    if (!cardRef.current) return
    if (reducedMotion.current) {
      cardRef.current.style.transform = ''
      cardRef.current.style.opacity = '1'
      if (overlayRef.current) { overlayRef.current.style.opacity = '0' }
      return
    }
    gsap.to(cardRef.current, {
      x: 0, y: 0, rotation: 0, opacity: 1,
      duration: 0.5, ease: 'elastic.out(1, 0.6)',
    })
    if (overlayRef.current) {
      overlayRef.current.style.opacity = '0'
      overlayRef.current.style.background = 'transparent'
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (stackIndex !== 0) return
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, x: 0, y: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [stackIndex])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging || stackIndex !== 0) return
    const x = e.clientX - dragState.current.startX
    const y = e.clientY - dragState.current.startY
    dragState.current.x = x
    dragState.current.y = y

    if (!cardRef.current) return
    if (reducedMotion.current) {
      cardRef.current.style.transform = `translate(${x}px, ${y}px)`
    } else {
      gsap.set(cardRef.current, { x, y, rotation: x * 0.08 })
    }

    if (!overlayRef.current) return
    const dir = getDirection(x, y)
    const absMax = Math.max(Math.abs(x), Math.abs(y < 0 ? y : 0))
    const opacity = Math.min(absMax / THRESHOLD, 1)
    overlayRef.current.style.opacity = String(opacity)
    overlayRef.current.style.background = getOverlayColor(dir)

    const content = getOverlayContent(dir)
    const inner = overlayRef.current.querySelector('[data-overlay-inner]') as HTMLElement | null
    if (inner && content) {
      inner.style.display = 'flex'
      inner.style.color = content.color
      const iconEl = inner.querySelector('[data-icon]')
      const labelEl = inner.querySelector('[data-label]')
      if (iconEl) iconEl.textContent = content.icon
      if (labelEl) labelEl.textContent = content.label
    } else if (inner) {
      inner.style.display = 'none'
    }
  }, [stackIndex, getDirection])

  const onPointerUp = useCallback(() => {
    if (!dragState.current.dragging || stackIndex !== 0) return
    dragState.current.dragging = false
    const { x, y } = dragState.current
    const dir = getDirection(x, y)
    if (dir === 'right') flyOut('right', 'postule')
    else if (dir === 'left') flyOut('left', 'ignore')
    else if (dir === 'up') flyOut('up', 'sauvegarde')
    else springBack()
  }, [stackIndex, getDirection, flyOut, springBack])

  const duration = getDuration(offer)
  const description = getDescription(offer)
  const stackStyle = getStackStyle(stackIndex)

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'absolute',
        width: '100%',
        cursor: stackIndex === 0 ? 'grab' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        ...stackStyle,
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: stackIndex === 0 ? '0 8px 32px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Source badge */}
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <span
            className="text-xs px-2 py-0.5 rounded border"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'rgba(99,102,241,0.2)' }}
          >
            {SOURCE_LABELS[offer.source ?? ''] ?? offer.source ?? 'Inconnu'}
          </span>
        </div>

        {/* Content */}
        <div style={{ paddingRight: 64 }}>
          <h3 className="font-semibold text-base leading-tight" style={{ color: 'var(--foreground)' }}>
            {offer.titre}
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {[offer.entreprise, offer.localisation].filter(Boolean).join(' · ')}
          </p>
          <div className="flex items-center gap-2 mt-3">
            {offer.type_contrat && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                {offer.type_contrat}
              </span>
            )}
            {duration && (
              <span className="text-xs" style={{ color: 'var(--muted)' }}>· {duration}</span>
            )}
          </div>
          {description && (
            <p
              className="text-xs mt-3 leading-relaxed"
              style={{
                color: 'var(--muted)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </p>
          )}
        </div>

        {/* Swipe overlay */}
        {stackIndex === 0 && (
          <div
            ref={overlayRef}
            style={{
              position: 'absolute', inset: 0, borderRadius: '16px',
              opacity: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              data-overlay-inner
              style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            >
              <span data-icon style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }} />
              <span data-label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }} />
            </div>
          </div>
        )}

        {/* Action buttons — always visible for accessibility */}
        {stackIndex === 0 && (
          <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              aria-label="Postuler"
              onClick={() => flyOut('right', 'postule')}
              className="flex-1 text-white text-xs font-medium py-2 rounded-lg transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              Postuler ✓
            </button>
            <button
              aria-label="Sauvegarder"
              onClick={() => flyOut('up', 'sauvegarde')}
              className="flex-1 text-xs py-2 rounded-lg border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              ⭐ Sauver
            </button>
            <button
              aria-label="Ignorer"
              onClick={() => flyOut('left', 'ignore')}
              className="px-3 text-xs py-2 rounded-lg transition-colors"
              style={{ color: 'var(--muted-light)' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
