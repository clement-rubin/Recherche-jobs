# Swipe Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tinder-like swipe card deck to `/offers` — swipe left=ignore, right=postuler, up=sauvegarder — with GSAP animations, fan deck visual, and a toggle between swipe/list on desktop.

**Architecture:** Three new components (`SwipeCard`, `SwipeDeck`, `ViewToggle`) wired into the existing `app/offers/page.tsx`. Pointer events handle both mouse and touch. GSAP animates card drag/fly-out/spring-back. View mode persisted in `localStorage`. No new API routes — uses existing `onAction` callback and `/api/offers` endpoint.

**Tech Stack:** Next.js 15 App Router, React, GSAP 3 (already installed), TypeScript, Jest + Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `components/offers/SwipeCard.tsx` | Single card: drag logic, overlay, GSAP animations, action buttons |
| Create | `components/offers/SwipeDeck.tsx` | Stack: manages [top, -1, -2] cards, prefetch, empty state |
| Create | `components/offers/ViewToggle.tsx` | Liste/Swipe toggle button, persists to localStorage |
| Modify | `app/offers/page.tsx` | Add ViewToggle to header, render SwipeDeck or existing grid |
| Create | `__tests__/components/offers/SwipeCard.test.tsx` | Unit tests for card render + action buttons |
| Create | `__tests__/components/offers/SwipeDeck.test.tsx` | Unit tests for deck state, empty state |
| Create | `__tests__/components/offers/ViewToggle.test.tsx` | Unit tests for toggle + localStorage |

---

### Task 1: ViewToggle component

**Files:**
- Create: `components/offers/ViewToggle.tsx`
- Create: `__tests__/components/offers/ViewToggle.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/components/offers/ViewToggle.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewToggle } from '@/components/offers/ViewToggle'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

beforeEach(() => localStorageMock.clear())

describe('ViewToggle', () => {
  it('renders Liste and Swipe buttons', () => {
    render(<ViewToggle mode="list" onChange={jest.fn()} />)
    expect(screen.getByText('Liste')).toBeInTheDocument()
    expect(screen.getByText('Swipe')).toBeInTheDocument()
  })

  it('calls onChange with "swipe" when Swipe clicked', () => {
    const onChange = jest.fn()
    render(<ViewToggle mode="list" onChange={onChange} />)
    fireEvent.click(screen.getByText('Swipe'))
    expect(onChange).toHaveBeenCalledWith('swipe')
  })

  it('calls onChange with "list" when Liste clicked', () => {
    const onChange = jest.fn()
    render(<ViewToggle mode="swipe" onChange={onChange} />)
    fireEvent.click(screen.getByText('Liste'))
    expect(onChange).toHaveBeenCalledWith('list')
  })

  it('active button has accent style (aria-pressed)', () => {
    render(<ViewToggle mode="swipe" onChange={jest.fn()} />)
    expect(screen.getByText('Swipe').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Liste').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/components/offers/ViewToggle.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/offers/ViewToggle'`

- [ ] **Step 3: Implement ViewToggle**

```typescript
// components/offers/ViewToggle.tsx
'use client'

type ViewMode = 'list' | 'swipe'

interface Props {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewToggle({ mode, onChange }: Props) {
  return (
    <div
      className="flex rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
    >
      {(['list', 'swipe'] as ViewMode[]).map((m) => {
        const active = mode === m
        return (
          <button
            key={m}
            aria-pressed={active}
            onClick={() => onChange(m)}
            className="px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--muted)',
            }}
          >
            {m === 'list' ? 'Liste' : 'Swipe'}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/components/offers/ViewToggle.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/offers/ViewToggle.tsx __tests__/components/offers/ViewToggle.test.tsx
git commit -m "feat(swipe): add ViewToggle list/swipe mode button"
```

---

### Task 2: SwipeCard — structure, data display, action buttons

**Files:**
- Create: `components/offers/SwipeCard.tsx`
- Create: `__tests__/components/offers/SwipeCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/components/offers/SwipeCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { SwipeCard } from '@/components/offers/SwipeCard'
import type { Offer } from '@/lib/supabase/types'

// Mock GSAP — jsdom has no layout engine
jest.mock('gsap', () => ({
  set: jest.fn(),
  to: jest.fn((_el, opts) => { opts?.onComplete?.() }),
  killTweensOf: jest.fn(),
}))

const offer: Offer = {
  id: 'o1',
  user_id: 'u1',
  titre: 'Ingénieur Full Stack',
  entreprise: 'Airbus',
  lien: 'https://example.com',
  salaire_min: null,
  salaire_max: null,
  localisation: 'Toulouse',
  source: 'jsearch',
  type_contrat: 'CDI',
  statut: 'non_traite',
  date_scraped: '2026-06-05',
  raw_data: { duree: '18 mois', description: 'Développement applications web temps réel pour systèmes embarqués.' },
}

describe('SwipeCard', () => {
  it('renders title, company and location', () => {
    render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={0} />)
    expect(screen.getByText('Ingénieur Full Stack')).toBeInTheDocument()
    expect(screen.getByText(/Airbus/)).toBeInTheDocument()
    expect(screen.getByText(/Toulouse/)).toBeInTheDocument()
  })

  it('renders contract type and duration from raw_data', () => {
    render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={0} />)
    expect(screen.getByText('CDI')).toBeInTheDocument()
    expect(screen.getByText(/18 mois/)).toBeInTheDocument()
  })

  it('renders description from raw_data', () => {
    render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={0} />)
    expect(screen.getByText(/Développement applications web/)).toBeInTheDocument()
  })

  it('calls onAction("postule") when Postuler button clicked', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined)
    render(<SwipeCard offer={offer} onAction={onAction} stackIndex={0} />)
    fireEvent.click(screen.getByRole('button', { name: /postuler/i }))
    expect(onAction).toHaveBeenCalledWith('o1', 'postule')
  })

  it('calls onAction("ignore") when Ignorer button clicked', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined)
    render(<SwipeCard offer={offer} onAction={onAction} stackIndex={0} />)
    fireEvent.click(screen.getByRole('button', { name: /ignorer/i }))
    expect(onAction).toHaveBeenCalledWith('o1', 'ignore')
  })

  it('calls onAction("sauvegarde") when Sauvegarder button clicked', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined)
    render(<SwipeCard offer={offer} onAction={onAction} stackIndex={0} />)
    fireEvent.click(screen.getByRole('button', { name: /sauvegarder/i }))
    expect(onAction).toHaveBeenCalledWith('o1', 'sauvegarde')
  })

  it('stacks card -1 with rotation 3deg style', () => {
    const { container } = render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={1} />)
    const card = container.firstChild as HTMLElement
    expect(card.style.transform).toContain('rotate(3deg)')
  })

  it('stacks card -2 with rotation 6deg style', () => {
    const { container } = render(<SwipeCard offer={offer} onAction={jest.fn()} stackIndex={2} />)
    const card = container.firstChild as HTMLElement
    expect(card.style.transform).toContain('rotate(6deg)')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/components/offers/SwipeCard.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/offers/SwipeCard'`

- [ ] **Step 3: Implement SwipeCard**

```typescript
// components/offers/SwipeCard.tsx
'use client'

import { useRef, useCallback } from 'react'
import gsap from 'gsap'
import type { Offer } from '@/lib/supabase/types'

const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  apec: 'APEC',
  hellowork: 'HelloWork',
  france_travail: 'France Travail',
  email: 'Email',
}

const THRESHOLD = 120 // px — 40% of ~300px card width

type Action = 'postule' | 'ignore' | 'sauvegarde'
type SwipeDirection = 'right' | 'left' | 'up' | null

interface Props {
  offer: Offer
  onAction: (id: string, action: Action) => Promise<void>
  /** 0 = top card, 1 = one behind, 2 = two behind */
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

export function SwipeCard({ offer, onAction, stackIndex }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, x: 0, y: 0 })

  const getDirection = (x: number, y: number): SwipeDirection => {
    const absX = Math.abs(x)
    const absY = Math.abs(y)
    if (y < -THRESHOLD * 0.5 && absY > absX) return 'up'
    if (x > THRESHOLD) return 'right'
    if (x < -THRESHOLD) return 'left'
    return null
  }

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
    gsap.set(cardRef.current, { x, y, rotation: x * 0.08 })

    if (!overlayRef.current) return
    const dir = getDirection(x, y)
    const absMax = Math.max(Math.abs(x), Math.abs(-y > 0 ? y : 0))
    const opacity = Math.min(absMax / THRESHOLD, 1)
    overlayRef.current.style.opacity = String(opacity)
    overlayRef.current.style.background = getOverlayColor(dir)

    // Update overlay content
    const content = getOverlayContent(dir)
    const inner = overlayRef.current.querySelector('[data-overlay-inner]') as HTMLElement | null
    if (inner && content) {
      inner.style.display = 'flex'
      inner.style.color = content.color
      inner.querySelector('[data-icon]')!.textContent = content.icon
      inner.querySelector('[data-label]')!.textContent = content.label
    } else if (inner) {
      inner.style.display = 'none'
    }
  }, [stackIndex])

  const onPointerUp = useCallback(() => {
    if (!dragState.current.dragging || stackIndex !== 0) return
    dragState.current.dragging = false
    const { x, y } = dragState.current
    const dir = getDirection(x, y)
    if (dir === 'right') flyOut('right', 'postule')
    else if (dir === 'left') flyOut('left', 'ignore')
    else if (dir === 'up') flyOut('up', 'sauvegarde')
    else springBack()
  }, [stackIndex, flyOut, springBack])

  const duration = getDuration(offer)
  const description = getDescription(offer)
  const stackStyle = getStackStyle(stackIndex)

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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

        {/* Swipe overlay — only shown on top card */}
        {stackIndex === 0 && (
          <div
            ref={overlayRef}
            style={{
              position: 'absolute', inset: 0, borderRadius: '16px',
              opacity: 0, transition: 'background 0.05s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              data-overlay-inner
              style={{
                display: 'none', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <span data-icon style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }} />
              <span data-label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }} />
            </div>
          </div>
        )}

        {/* Action buttons — always visible for accessibility */}
        {stackIndex === 0 && (
          <div
            className="flex gap-2 mt-4 pt-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/components/offers/SwipeCard.test.tsx
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add components/offers/SwipeCard.tsx __tests__/components/offers/SwipeCard.test.tsx
git commit -m "feat(swipe): add SwipeCard with drag logic, GSAP fly-out and spring-back"
```

---

### Task 3: SwipeDeck — stack management and empty state

**Files:**
- Create: `components/offers/SwipeDeck.tsx`
- Create: `__tests__/components/offers/SwipeDeck.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/components/offers/SwipeDeck.test.tsx
import { render, screen, act } from '@testing-library/react'
import { SwipeDeck } from '@/components/offers/SwipeDeck'
import type { Offer } from '@/lib/supabase/types'

jest.mock('gsap', () => ({
  set: jest.fn(),
  to: jest.fn((_el, opts) => { opts?.onComplete?.() }),
  fromTo: jest.fn((_el, _from, opts) => { opts?.onComplete?.() }),
  killTweensOf: jest.fn(),
}))

const makeOffer = (id: string): Offer => ({
  id,
  user_id: 'u1',
  titre: `Offre ${id}`,
  entreprise: 'ACME',
  lien: null,
  salaire_min: null,
  salaire_max: null,
  localisation: 'Paris',
  source: 'jsearch',
  type_contrat: 'CDI',
  statut: 'non_traite',
  date_scraped: '2026-06-05',
  raw_data: null,
})

describe('SwipeDeck', () => {
  it('renders top card title', () => {
    const offers = [makeOffer('a'), makeOffer('b'), makeOffer('c')]
    render(<SwipeDeck offers={offers} onAction={jest.fn()} onNeedMore={jest.fn()} />)
    expect(screen.getByText('Offre a')).toBeInTheDocument()
  })

  it('shows empty state when offers array is empty', () => {
    render(<SwipeDeck offers={[]} onAction={jest.fn()} onNeedMore={jest.fn()} />)
    expect(screen.getByText(/plus d'offres/i)).toBeInTheDocument()
  })

  it('calls onNeedMore when 3 or fewer cards remain', () => {
    const onNeedMore = jest.fn()
    render(<SwipeDeck offers={[makeOffer('a'), makeOffer('b')]} onAction={jest.fn()} onNeedMore={onNeedMore} />)
    expect(onNeedMore).toHaveBeenCalled()
  })

  it('calls onAction and removes top card after action', async () => {
    const onAction = jest.fn().mockResolvedValue(undefined)
    render(<SwipeDeck offers={[makeOffer('a'), makeOffer('b')]} onAction={onAction} onNeedMore={jest.fn()} />)
    // simulate action via deck's internal handler (exposed via data-testid)
    const deck = screen.getByTestId('swipe-deck')
    // Trigger via the card's Postuler button
    const btn = screen.getByRole('button', { name: /postuler/i })
    await act(async () => { btn.click() })
    expect(onAction).toHaveBeenCalledWith('a', 'postule')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/components/offers/SwipeDeck.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/offers/SwipeDeck'`

- [ ] **Step 3: Implement SwipeDeck**

```typescript
// components/offers/SwipeDeck.tsx
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

  // Sync new offers in (prefetch batch arrives)
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
    // Animate next card rising to top
    setStack(prev => {
      const next = prev.filter(o => o.id !== id)
      // Animate new top card (was index 1, now index 0)
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

  // Render top 3 in reverse order so top card is rendered last (on top in DOM)
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/components/offers/SwipeDeck.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/offers/SwipeDeck.tsx __tests__/components/offers/SwipeDeck.test.tsx
git commit -m "feat(swipe): add SwipeDeck with stack management and prefetch trigger"
```

---

### Task 4: Wire SwipeDeck into offers page + view mode persistence

**Files:**
- Modify: `app/offers/page.tsx`

- [ ] **Step 1: Add view mode hook and ViewToggle to header**

At the top of `OffersPage`, after the existing state declarations, add:

```typescript
// Import at top of file
import { SwipeDeck } from '@/components/offers/SwipeDeck'
import { ViewToggle } from '@/components/offers/ViewToggle'
import { useEffect } from 'react' // add if not present
```

Add state and localStorage logic inside `OffersPage` (after existing `const [confirmClear, setConfirmClear]`):

```typescript
// View mode: 'swipe' default on mobile, 'list' on desktop
const [viewMode, setViewMode] = useState<'list' | 'swipe'>('list')

useEffect(() => {
  const stored = localStorage.getItem('offers-view-mode') as 'list' | 'swipe' | null
  if (stored) {
    setViewMode(stored)
  } else {
    // Default: swipe on mobile, list on desktop
    setViewMode(window.innerWidth < 1024 ? 'swipe' : 'list')
  }
}, [])

const handleViewModeChange = (mode: 'list' | 'swipe') => {
  setViewMode(mode)
  localStorage.setItem('offers-view-mode', mode)
}
```

- [ ] **Step 2: Add ViewToggle to the header div**

Replace the existing header `<div className="flex items-start justify-between gap-4">` block with:

```tsx
<div className="flex items-start justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Offres à traiter</h1>
    <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{offers.length} offre{offers.length !== 1 ? 's' : ''}</p>
  </div>
  <div className="flex items-center gap-2 mt-1 flex-shrink-0">
    <ViewToggle mode={viewMode} onChange={handleViewModeChange} />
    {offers.length > 0 && viewMode === 'list' && (
      <button
        onClick={() => setConfirmClear(true)}
        className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        Tout ignorer
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 3: Replace grid with conditional SwipeDeck / grid**

Find the block starting with `offers.length === 0 ? (` near the bottom and replace the entire conditional with:

```tsx
{offers.length === 0 && viewMode === 'list' ? (
  <div className="rounded-xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
    <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>Aucune offre</p>
    <p className="text-sm" style={{ color: 'var(--muted)' }}>Les offres apparaîtront ici après synchronisation ou recherche manuelle.</p>
  </div>
) : viewMode === 'swipe' ? (
  <SwipeDeck
    offers={offers}
    onAction={handleAction}
    onNeedMore={() => {
      // re-fetch if near empty — existing fetchOffers refreshes from server
      if (offers.length <= 3) fetchOffers()
    }}
  />
) : (
  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
    {offers.map(offer => (
      <OfferCard key={offer.id} offer={offer} onAction={handleAction} />
    ))}
  </div>
)}
```

- [ ] **Step 4: Run full type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/offers/page.tsx
git commit -m "feat(swipe): wire SwipeDeck into offers page with view mode toggle"
```

---

### Task 5: Reduced-motion support

**Files:**
- Modify: `components/offers/SwipeCard.tsx`

- [ ] **Step 1: Add prefers-reduced-motion guard to GSAP calls**

In `SwipeCard.tsx`, add helper at the top (after imports):

```typescript
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
```

Then wrap every `gsap.to` and `gsap.set` call with a check:

```typescript
// Replace every: gsap.to(cardRef.current, { ... })
// With:
if (prefersReducedMotion()) {
  // instant — no animation
  if (cardRef.current) {
    cardRef.current.style.transform = ''
    cardRef.current.style.opacity = '1'
  }
  fireAction(action) // for fly-out
} else {
  gsap.to(cardRef.current, { ... })
}
```

Apply to:
- `flyOut` function: skip GSAP, call `fireAction(action)` directly when reduced motion
- `springBack` function: skip GSAP, reset `cardRef.current.style` directly
- `onPointerMove` handler: skip `gsap.set`, use `cardRef.current.style.transform` directly

- [ ] **Step 2: Verify type-check still passes**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/offers/SwipeCard.tsx
git commit -m "feat(swipe): add prefers-reduced-motion support to SwipeCard"
```

---

### Task 6: Run full test suite + smoke test

- [ ] **Step 1: Run all tests**

```bash
npx tsc --noEmit && npx jest --no-coverage
```

Expected: 0 type errors, all tests pass (28 existing + new swipe tests).

- [ ] **Step 2: Start dev server and smoke test**

```bash
npm run dev
```

- [ ] Visit `http://localhost:3000/offers`
- [ ] On desktop: toggle "Swipe" → deck appears, centered, max ~420px wide
- [ ] Click "Postuler ✓" button → card flies right, next card animates up
- [ ] Click "⭐ Sauver" button → card flies up, next card animates up
- [ ] Click "✕" button → card flies left
- [ ] Drag card right → green overlay appears after ~30% drag distance
- [ ] Drag card left → red overlay appears
- [ ] Drag card up → yellow overlay appears
- [ ] Release before threshold → card springs back with elastic animation
- [ ] Release past threshold → card flies out
- [ ] Toggle back "Liste" → grid view restored
- [ ] Refresh page → mode persisted from localStorage
- [ ] On mobile viewport (DevTools 390px) → swipe mode is default

- [ ] **Step 3: Build verification**

```bash
npm run build
```

Expected: build succeeds with 0 errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(swipe): complete swipe deck implementation with tests"
git push
```
