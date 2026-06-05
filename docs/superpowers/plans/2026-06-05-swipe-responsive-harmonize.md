# Swipe Fix + Responsive + Harmonisation GSAP/UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix swipe z-stacking bug (éventail style), make search page responsive on iPhone 12, and harmonize GSAP performance + UI polish across SwipeCard/SwipeDeck.

**Architecture:** Move all stack transforms (rotation, scale, zIndex) from SwipeCard's inner div to SwipeDeck's wrapper divs — GSAP owns those transforms exclusively via `useEffect([stack])`. SwipeCard becomes `position:relative` and handles only drag interaction. Responsive fixes use Tailwind breakpoint classes only (no JS).

**Tech Stack:** Next.js 16 App Router, React, GSAP 3.15, Tailwind CSS v4, TypeScript, Jest + Testing Library

---

## File Map

| File | Change |
|------|--------|
| `components/offers/SwipeDeck.tsx` | GSAP context, wrapper owns transforms, useEffect drives promote animation |
| `components/offers/SwipeCard.tsx` | `stackIndex→isTop`, `position:relative`, quickSetters, UI polish |
| `__tests__/components/offers/SwipeDeck.test.tsx` | Update mock + tests for new architecture |
| `__tests__/components/offers/SwipeCard.test.tsx` | Update prop `isTop`, remove rotation-on-root assertions |
| `app/search/page.tsx` | flex-col mobile, header button |
| `components/search/ProfileModal.tsx` | Grid responsive, padding, max-height, ring presets, optgroup |

---

## Task 1: Update SwipeDeck tests first (TDD)

**Files:**
- Modify: `__tests__/components/offers/SwipeDeck.test.tsx`

- [ ] **Step 1: Update GSAP mock to include `fromTo` and `context`**

Replace the mock block (lines 19-24) with:

```typescript
jest.mock('gsap', () => ({
  set: jest.fn(),
  to: jest.fn((_el: unknown, opts: { onComplete?: () => void }) => { opts?.onComplete?.() }),
  fromTo: jest.fn(),
  killTweensOf: jest.fn(),
  context: jest.fn(() => ({ revert: jest.fn() })),
  quickSetter: jest.fn(() => jest.fn()),
}))
```

- [ ] **Step 2: Add test for "after action, top card changes"**

Add inside `describe('SwipeDeck')`:

```typescript
it('removes top card from DOM after action', async () => {
  const onAction = jest.fn().mockResolvedValue(undefined)
  render(<SwipeDeck offers={[makeOffer('a'), makeOffer('b'), makeOffer('c')]} onAction={onAction} onNeedMore={jest.fn()} />)
  expect(screen.getByText('Offre a')).toBeInTheDocument()
  await act(async () => {
    screen.getByRole('button', { name: /postuler/i }).click()
  })
  expect(screen.queryByText('Offre a')).not.toBeInTheDocument()
  expect(screen.getByText('Offre b')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run tests — expect failures on the new test (SwipeDeck not yet updated)**

```bash
npx jest --no-coverage __tests__/components/offers/SwipeDeck.test.tsx
```

Expected: existing tests pass, new "removes top card" test may fail depending on current behavior.

- [ ] **Step 4: Commit tests**

```bash
git add __tests__/components/offers/SwipeDeck.test.tsx
git commit -m "test(SwipeDeck): update GSAP mock, add post-action card removal assertion"
```

---

## Task 2: Update SwipeCard tests (TDD)

**Files:**
- Modify: `__tests__/components/offers/SwipeCard.test.tsx`

- [ ] **Step 1: Update GSAP mock to add `fromTo` and `quickSetter`**

Replace the mock block (lines 19-23):

```typescript
jest.mock('gsap', () => ({
  set: jest.fn(),
  to: jest.fn((_el: unknown, opts: { onComplete?: () => void }) => { opts?.onComplete?.() }),
  fromTo: jest.fn(),
  killTweensOf: jest.fn(),
  quickSetter: jest.fn(() => jest.fn()),
}))
```

- [ ] **Step 2: Replace `stackIndex` prop with `isTop` in all test renders**

Find every occurrence of `stackIndex={0}` and replace with `isTop={true}`.  
Find every occurrence of `stackIndex={1}` and `stackIndex={2}` — replace with `isTop={false}`.

Result — every render call uses `isTop`:

```typescript
render(<SwipeCard offer={offer} onAction={jest.fn()} isTop={true} />)
// or
render(<SwipeCard offer={offer} onAction={jest.fn()} isTop={false} />)
```

- [ ] **Step 3: Remove the two rotation-on-root assertions (lines 85-95)**

Delete these tests entirely — rotation now lives on SwipeDeck wrappers, not SwipeCard root:

```typescript
// DELETE:
it('stacks card -1 with rotation 3deg style', ...)
it('stacks card -2 with rotation 6deg style', ...)
```

- [ ] **Step 4: Add test — non-top card hides buttons**

Add inside `describe('SwipeCard')`:

```typescript
it('does not render action buttons when isTop=false', () => {
  render(<SwipeCard offer={offer} onAction={jest.fn()} isTop={false} />)
  expect(screen.queryByRole('button', { name: /postuler/i })).not.toBeInTheDocument()
})

it('renders action buttons when isTop=true', () => {
  render(<SwipeCard offer={offer} onAction={jest.fn()} isTop={true} />)
  expect(screen.getByRole('button', { name: /postuler/i })).toBeInTheDocument()
})
```

- [ ] **Step 5: Run — expect failures (SwipeCard still uses old prop)**

```bash
npx jest --no-coverage __tests__/components/offers/SwipeCard.test.tsx
```

Expected: TypeScript errors on `isTop` prop not existing yet, or prop-mismatch failures.

- [ ] **Step 6: Commit tests**

```bash
git add __tests__/components/offers/SwipeCard.test.tsx
git commit -m "test(SwipeCard): prop stackIndex→isTop, remove rotation-on-root assertions, add isTop button visibility"
```

---

## Task 3: Refactor SwipeDeck — wrappers own transforms

**Files:**
- Modify: `components/offers/SwipeDeck.tsx`

- [ ] **Step 1: Rewrite SwipeDeck.tsx completely**

```typescript
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
```

- [ ] **Step 2: Run SwipeDeck tests**

```bash
npx jest --no-coverage __tests__/components/offers/SwipeDeck.test.tsx
```

Expected: all pass (SwipeCard still uses old prop, but SwipeDeck tests render via SwipeCard — TypeScript will catch at build time, not Jest).

- [ ] **Step 3: Commit**

```bash
git add components/offers/SwipeDeck.tsx
git commit -m "refactor(SwipeDeck): wrappers own GSAP transforms, promote animation in useEffect, gsap.context cleanup"
```

---

## Task 4: Refactor SwipeCard — `isTop`, quickSetters, position:relative

**Files:**
- Modify: `components/offers/SwipeCard.tsx`

- [ ] **Step 1: Rewrite SwipeCard.tsx completely**

```typescript
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
        position:   'relative',
        cursor:     isTop ? 'grab' : 'default',
        userSelect: 'none',
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
```

- [ ] **Step 2: Run all offer tests**

```bash
npx jest --no-coverage __tests__/components/offers/
```

Expected: all pass.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/offers/SwipeCard.tsx components/offers/SwipeDeck.tsx
git commit -m "refactor(SwipeCard): isTop prop, position:relative, quickSetters drag, GSAP force3D, source badge colors, overlay polish"
```

---

## Task 5: Search page responsive

**Files:**
- Modify: `app/search/page.tsx`

- [ ] **Step 1: Replace profile card inner layout**

Find this block (around line 108-163):

```tsx
<div key={profile.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
  <div className="flex items-start justify-between">
    <div className="flex-1">
      ...profile info...
    </div>
    <div className="flex items-center gap-2 ml-4">
      <button onClick={() => handleActivate(...)}>...</button>
      <button onClick={() => setEditProfile(profile)}>Éditer</button>
      <button onClick={() => setDeleteConfirmId(profile.id)}>Sup.</button>
    </div>
  </div>
  <InlineConfirm ... />
</div>
```

Replace with:

```tsx
<div
  key={profile.id}
  className="bg-card border border-border rounded-xl p-4 space-y-3 transition-shadow duration-200 hover:shadow-md"
>
  {/* Info — always full width */}
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 flex-wrap">
      <h3 className="font-medium" style={{ color: 'var(--foreground)' }}>
        {profile.nom || 'Profil sans nom'}
      </h3>
      {profile.actif && (
        <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">
          Actif
        </span>
      )}
    </div>
    <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
      {profile.localisation} · {profile.rayon_km}km
    </p>
    {(profile.mots_cles ?? []).length > 0 && (
      <p className="text-xs mt-1" style={{ color: 'var(--muted-light)' }}>
        Mots-clés : {(profile.mots_cles ?? []).join(', ')}
      </p>
    )}
    {(profile.qualifications ?? []).length > 0 && (
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-light)' }}>
        Qualifications : {(profile.qualifications ?? []).join(', ')}
      </p>
    )}
    {(profile.type_contrat ?? []).length > 0 && (
      <div className="flex flex-wrap gap-1 mt-1">
        {(profile.type_contrat ?? []).map(ct => (
          <span
            key={ct}
            className="text-xs px-2 py-0.5 rounded capitalize"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            {ct}
          </span>
        ))}
      </div>
    )}
  </div>

  {/* Action buttons — below info on all screens, right-aligned */}
  <div className="flex items-center gap-2 border-t border-border pt-1">
    <button
      onClick={() => handleActivate(profile.id, profile.actif)}
      className="flex-1 text-xs px-3 py-2.5 rounded-lg border transition-colors min-h-[36px]"
      style={
        profile.actif
          ? { borderColor: 'var(--border)', color: 'var(--muted)' }
          : { borderColor: 'var(--accent)', color: 'var(--accent)' }
      }
    >
      {profile.actif ? 'Désactiver' : 'Activer'}
    </button>
    <button
      onClick={() => setEditProfile(profile)}
      className="text-xs px-3 py-2.5 rounded-lg transition-colors hover:bg-zinc-100 min-h-[36px]"
      style={{ color: 'var(--muted)' }}
    >
      Éditer
    </button>
    <button
      onClick={() => setDeleteConfirmId(profile.id)}
      className="text-xs px-3 py-2.5 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500 min-h-[36px]"
      style={{ color: 'var(--muted)' }}
    >
      ✕
    </button>
  </div>

  <InlineConfirm
    visible={deleteConfirmId === profile.id}
    message="Supprimer ce profil ?"
    confirmLabel="Supprimer"
    onConfirm={() => handleDelete(profile.id)}
    onCancel={() => setDeleteConfirmId(null)}
  />
</div>
```

- [ ] **Step 2: Collapse "Lancer maintenant" text on mobile**

Find:
```tsx
>
  ↻ Lancer maintenant
</AsyncButton>
```

Replace with:
```tsx
>
  <span className="sm:hidden">↻</span>
  <span className="hidden sm:inline">↻ Lancer maintenant</span>
</AsyncButton>
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/search/page.tsx
git commit -m "feat(search): responsive profile cards — flex-col layout, 36px touch targets, mobile header button"
```

---

## Task 6: ProfileModal responsive

**Files:**
- Modify: `components/search/ProfileModal.tsx`

- [ ] **Step 1: Update DUREE_OPTIONS to use optgroup-friendly structure**

Add group metadata to `DUREE_OPTIONS`:

```typescript
const DUREE_GROUPS = [
  {
    label: 'Court terme',
    options: [
      { value: '1_semaine',    label: '1 semaine' },
      { value: '2_semaines',   label: '2 semaines' },
      { value: '3_semaines',   label: '3 semaines' },
      { value: 'moins_1_mois', label: 'Moins de 1 mois' },
    ],
  },
  {
    label: 'Moyen terme',
    options: [
      { value: '1_3_mois', label: '1 à 3 mois' },
      { value: '3_6_mois', label: '3 à 6 mois' },
    ],
  },
  {
    label: 'Long terme',
    options: [
      { value: '6_plus', label: '6 mois et plus' },
    ],
  },
]
```

Remove the old `DUREE_OPTIONS` array (no longer needed).

- [ ] **Step 2: Update select to use `<optgroup>` and responsive grids**

Find the `<div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">` line and change to:
```tsx
<div className="px-4 sm:px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
```

Find the localisation+rayon grid:
```tsx
<div className="grid grid-cols-2 gap-3">
```
Replace with:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

Find the durée+salaire grid (same pattern):
```tsx
<div className="grid grid-cols-2 gap-3">
```
Replace with:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

Replace the select content:
```tsx
<select
  value={form.duree_contrat ?? 'peu_importe'}
  onChange={e => setForm(f => ({ ...f, duree_contrat: e.target.value as SearchProfile['duree_contrat'] }))}
  className={inputClass}
>
  <option value="peu_importe">Peu importe</option>
  {DUREE_GROUPS.map(group => (
    <optgroup key={group.label} label={group.label}>
      {group.options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </optgroup>
  ))}
</select>
```

- [ ] **Step 3: Update exclusion preset button active style to add ring**

Find the active style on preset buttons:
```tsx
active
  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
  : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }
```

Update className to include ring when active:
```tsx
className={`px-2 py-0.5 rounded text-xs border transition-colors ${
  active ? 'ring-1 ring-accent ring-offset-1' : ''
}`}
style={
  active
    ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
    : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }
}
```

- [ ] **Step 4: Update modal card max-width padding**

Find the card div:
```tsx
<div
  ref={cardRef}
  className="w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
```

No change needed on max-w-lg (correct). Only the body padding changed (done in step 2).

- [ ] **Step 5: Run type check + tests**

```bash
npx tsc --noEmit && npx jest --no-coverage
```

Expected: all 45+ tests pass, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add components/search/ProfileModal.tsx
git commit -m "feat(ProfileModal): responsive grids sm:grid-cols-2, optgroup duration select, ring on active exclusion presets"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 2: Full type check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Manual smoke test checklist**

1. Ouvrir `/offers` — swipe deck affiche 3 cartes en éventail (coins du fond visibles)
2. Swiper la première carte → deuxième promue avec animation spring, troisième visible derrière
3. Swiper à droite (Postuler), à gauche (Ignorer), vers le haut (Sauver)
4. Ouvrir `/search` sur écran 390px (DevTools iPhone 12) — boutons d'action sur une rangée dédiée sous les infos
5. Ouvrir ProfileModal sur iPhone 12 — grids en colonne, select durée avec optgroups
6. Vérifier badge source : JSearch = indigo, France Travail = blue, HelloWork = emerald, email = amber
