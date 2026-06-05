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

export function SwipeDeck({ offers, onAction, onNeedMore }: Props) {
  const [stack, setStack] = useState<Offer[]>(offers)
  const prevOffersRef = useRef<Offer[]>(offers)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  // Sync new offers (prefetch batch arrives)
  useEffect(() => {
    const prev = prevOffersRef.current
    const newOnes = offers.filter(o => !prev.find(p => p.id === o.id))
    if (newOnes.length > 0) {
      setStack(s => [...s, ...newOnes])
    }
    prevOffersRef.current = offers
  }, [offers])

  // Request more when running low
  useEffect(() => {
    if (stack.length <= 3) onNeedMore()
  }, [stack.length, onNeedMore])

  const handleAction = async (id: string, action: 'postule' | 'ignore' | 'sauvegarde') => {
    await onAction(id, action)
    setStack(prev => {
      const next = prev.filter(o => o.id !== id)
      const newTopRef = cardRefs.current[1]
      if (newTopRef && typeof requestAnimationFrame !== 'undefined') {
        gsap.fromTo(newTopRef,
          { rotation: 3, scale: 0.97 },
          { rotation: 0, scale: 1, duration: 0.4, ease: 'back.out(1.2)' }
        )
      }
      return next
    })
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
      style={{ position: 'relative', height: 320, maxWidth: 420, margin: '0 auto' }}
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
              stackIndex={stackIndex}
            />
          </div>
        )
      })}
    </div>
  )
}
