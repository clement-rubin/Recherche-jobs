'use client'

import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { Offer } from '@/lib/supabase/types'
import { SwipeCard } from './SwipeCard'

interface Props {
  offers: Offer[]
  onAction: (id: string, action: 'postule' | 'ignore' | 'sauvegarde') => Promise<void>
  onNeedMore: () => void
}

const ROTATIONS = [0, 3, 6]
const SCALES    = [1, 0.97, 0.94]

export function SwipeDeck({ offers, onAction, onNeedMore }: Props) {
  const [stack, setStack] = useState<Offer[]>(offers)
  const prevOffersRef   = useRef<Offer[]>(offers)
  const cardRefs        = useRef<(HTMLDivElement | null)[]>([])
  const needMoreRef     = useRef(false)
  const prevTopIdRef    = useRef<string | null>(offers[0]?.id ?? null)
  const gsapCtx         = useRef<gsap.Context | null>(null)

  // Merge prefetched offers into stack
  useEffect(() => {
    const prev = prevOffersRef.current
    const newOnes = offers.filter(o => !prev.find(p => p.id === o.id))
    if (newOnes.length > 0) setStack(s => [...s, ...newOnes])
    prevOffersRef.current = offers
  }, [offers])

  // GSAP context — single cleanup point
  useEffect(() => {
    gsapCtx.current = gsap.context(() => {})
    return () => { gsapCtx.current?.revert() }
  }, [])

  // Apply stack transforms whenever stack changes — GSAP sole owner of wrapper transforms
  useEffect(() => {
    const visible   = stack.slice(0, 3)
    const newTopId  = visible[0]?.id ?? null
    const promoted  = prevTopIdRef.current !== null && prevTopIdRef.current !== newTopId

    visible.forEach((_, stackIndex) => {
      const el = cardRefs.current[stackIndex]
      if (!el) return

      gsap.set(el, {
        zIndex:          3 - stackIndex,
        transformOrigin: 'bottom center',
        force3D:         true,
      })

      if (stackIndex === 0 && promoted) {
        gsap.fromTo(el,
          { rotation: ROTATIONS[1], scale: SCALES[1] },
          { rotation: 0, scale: 1, duration: 0.4, ease: 'back.out(1.2)', force3D: true }
        )
      } else {
        gsap.set(el, { rotation: ROTATIONS[stackIndex] ?? 0, scale: SCALES[stackIndex] ?? 0.94 })
      }

      // will-change only on interactive top card
      el.style.willChange = stackIndex === 0 ? 'transform' : 'auto'
    })

    prevTopIdRef.current = newTopId
  }, [stack])

  // Trigger prefetch when running low
  useEffect(() => {
    if (stack.length <= 3 && !needMoreRef.current) {
      needMoreRef.current = true
      onNeedMore()
    }
    if (stack.length > 3) needMoreRef.current = false
  }, [stack.length, onNeedMore])

  const handleAction = async (id: string, action: 'postule' | 'ignore' | 'sauvegarde') => {
    await onAction(id, action)
    setStack(prev => prev.filter(o => o.id !== id))
  }

  if (stack.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl p-12 text-center"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', minHeight: 280 }}
      >
        <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>Plus d&apos;offres à traiter</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Revenez après la prochaine synchronisation.</p>
      </div>
    )
  }

  const visible = stack.slice(0, 3)

  return (
    <div
      data-testid="swipe-deck"
      style={{ position: 'relative', height: 360, maxWidth: 420, margin: '0 auto' }}
    >
      {[...visible].reverse().map((offer, reversedIdx) => {
        const stackIndex = visible.length - 1 - reversedIdx
        return (
          <div
            key={offer.id}
            ref={el => { cardRefs.current[stackIndex] = el }}
            style={{ position: 'absolute', width: '100%', top: 0 }}
          >
            <SwipeCard
              offer={offer}
              onAction={handleAction}
              isTop={stackIndex === 0}
            />
          </div>
        )
      })}
    </div>
  )
}
