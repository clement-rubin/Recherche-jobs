'use client'

import { useRef, useCallback, useEffect } from 'react'
import gsap from 'gsap'
import type { Offer } from '@/lib/supabase/types'

const SOURCE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  jsearch:       { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-200' },
  france_travail:{ bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200'   },
  hellowork:     { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200'},
  email:         { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200'  },
}
const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch', apec: 'APEC', hellowork: 'HelloWork',
  france_travail: 'France Travail', email: 'Email',
}

const THRESHOLD = 120
type Action = 'postule' | 'ignore' | 'sauvegarde'
type SwipeDirection = 'right' | 'left' | 'up' | null

interface Props {
  offer: Offer
  onAction: (id: string, action: Action) => Promise<void>
  isTop: boolean
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

export function SwipeCard({ offer, onAction, isTop }: Props) {
  const cardRef    = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragState  = useRef({ dragging: false, startX: 0, startY: 0, x: 0, y: 0 })
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  // quickSetters — created once, reused every pointermove (no GSAP re-parsing overhead)
  const quickX   = useRef<((v: number) => void) | null>(null)
  const quickY   = useRef<((v: number) => void) | null>(null)
  const quickRot = useRef<((v: number) => void) | null>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    quickX.current   = gsap.quickSetter(card, 'x', 'px') as (v: number) => void
    quickY.current   = gsap.quickSetter(card, 'y', 'px') as (v: number) => void
    quickRot.current = gsap.quickSetter(card, 'rotation', 'deg') as (v: number) => void
    return () => { gsap.killTweensOf(card) }
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
    if (dir === 'left')  return 'rgba(239,68,68,0.25)'
    if (dir === 'up')    return 'rgba(250,204,21,0.2)'
    return 'transparent'
  }

  const getOverlayContent = (dir: SwipeDirection) => {
    if (dir === 'right') return { icon: '✓', label: 'POSTULER',    color: '#4ade80' }
    if (dir === 'left')  return { icon: '✕', label: 'IGNORER',     color: '#f87171' }
    if (dir === 'up')    return { icon: '⭐', label: 'SAUVEGARDER', color: '#fbbf24' }
    return null
  }

  const fireAction = useCallback(async (action: Action) => {
    await onAction(offer.id, action)
  }, [offer.id, onAction])

  const flyOut = useCallback((dir: SwipeDirection, action: Action) => {
    if (!cardRef.current) return
    dragState.current.dragging = false
    gsap.killTweensOf(cardRef.current)
    if (reducedMotion.current) { fireAction(action); return }
    const x        = dir === 'right' ? 600 : dir === 'left' ? -600 : 0
    const y        = dir === 'up' ? -600 : 0
    const rotation = dir === 'right' ? 30 : dir === 'left' ? -30 : 0
    gsap.to(cardRef.current, {
      x, y, rotation, opacity: 0,
      duration: 0.35, ease: 'power2.in', force3D: true,
      onComplete: () => fireAction(action),
    })
  }, [fireAction])

  const springBack = useCallback(() => {
    if (!cardRef.current) return
    if (reducedMotion.current) {
      gsap.set(cardRef.current, { x: 0, y: 0, rotation: 0, opacity: 1 })
      if (overlayRef.current) { overlayRef.current.style.opacity = '0' }
      return
    }
    gsap.to(cardRef.current, {
      x: 0, y: 0, rotation: 0, opacity: 1,
      duration: 0.5, ease: 'elastic.out(1, 0.6)', force3D: true,
    })
    if (overlayRef.current) {
      overlayRef.current.style.opacity = '0'
      overlayRef.current.style.background = 'transparent'
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isTop) return
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, x: 0, y: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [isTop])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging || !isTop) return
    const x = e.clientX - dragState.current.startX
    const y = e.clientY - dragState.current.startY
    dragState.current.x = x
    dragState.current.y = y

    if (reducedMotion.current) {
      if (cardRef.current) cardRef.current.style.transform = `translate(${x}px,${y}px)`
    } else {
      quickX.current?.(x)
      quickY.current?.(y)
      quickRot.current?.(x * 0.08)
    }

    if (!overlayRef.current) return
    const dir    = getDirection(x, y)
    const absMax = Math.max(Math.abs(x), Math.abs(y < 0 ? y : 0))
    const opacity = Math.min(absMax / THRESHOLD, 1)
    overlayRef.current.style.opacity    = String(opacity)
    overlayRef.current.style.background = getOverlayColor(dir)

    const content = getOverlayContent(dir)
    const inner   = overlayRef.current.querySelector('[data-overlay-inner]') as HTMLElement | null
    if (inner && content) {
      inner.style.display = 'flex'
      inner.style.color   = content.color
      const iconEl  = inner.querySelector('[data-icon]')
      const labelEl = inner.querySelector('[data-label]')
      if (iconEl)  iconEl.textContent  = content.icon
      if (labelEl) labelEl.textContent = content.label
    } else if (inner) {
      inner.style.display = 'none'
    }
  }, [isTop, getDirection])

  const onPointerUp = useCallback(() => {
    if (!dragState.current.dragging || !isTop) return
    dragState.current.dragging = false
    const { x, y } = dragState.current
    const dir = getDirection(x, y)
    if (dir === 'right')     flyOut('right', 'postule')
    else if (dir === 'left') flyOut('left',  'ignore')
    else if (dir === 'up')   flyOut('up',    'sauvegarde')
    else                     springBack()
  }, [isTop, getDirection, flyOut, springBack])

  const duration    = getDuration(offer)
  const description = getDescription(offer)
  const badge       = SOURCE_BADGE[offer.source ?? ''] ?? { bg: 'bg-zinc-50', text: 'text-zinc-500', border: 'border-zinc-200' }
  const sourceLabel = SOURCE_LABELS[offer.source ?? ''] ?? offer.source ?? 'Inconnu'

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position:    'relative',
        cursor:      isTop ? 'grab' : 'default',
        userSelect:  'none',
        touchAction: 'none',
      }}
    >
      <div
        style={{
          background:   'var(--card)',
          border:       '1px solid var(--border)',
          borderRadius: '16px',
          padding:      'clamp(16px, 4vw, 20px)',
          boxShadow:    isTop ? '0 8px 32px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
          position:     'relative',
          overflow:     'hidden',
        }}
      >
        {/* Source badge */}
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <span className={`text-xs px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
            {sourceLabel}
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
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </p>
          )}
        </div>

        {/* Swipe overlay */}
        {isTop && (
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
              <span data-icon  style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
              <span data-label style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }} />
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isTop && (
          <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              aria-label="Postuler"
              onClick={() => flyOut('right', 'postule')}
              className="flex-1 text-white text-xs font-medium py-2.5 rounded-lg transition-all hover:shadow-[0_2px_8px_rgba(99,102,241,0.3)]"
              style={{ background: 'var(--accent)' }}
            >
              Postuler ✓
            </button>
            <button
              aria-label="Sauvegarder"
              onClick={() => flyOut('up', 'sauvegarde')}
              className="flex-1 text-xs py-2.5 rounded-lg border transition-colors hover:text-amber-500"
              style={{ borderColor: 'rgba(251,191,36,0.4)', color: 'var(--muted)' }}
            >
              ⭐ Sauver
            </button>
            <button
              aria-label="Ignorer"
              onClick={() => flyOut('left', 'ignore')}
              className="px-3 text-xs py-2.5 rounded-lg transition-colors hover:bg-red-50 hover:text-red-400"
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
