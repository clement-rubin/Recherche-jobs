# Swipe Deck — Design Spec
**Date:** 2026-06-05  
**Status:** Approved

## Goal

Replace the grid list view on `/offers` with a Tinder-like swipe card deck on mobile (default) and add it as an optional toggle on desktop. Swipe left = ignore, right = postuler, up = sauvegarder. Animated with GSAP.

---

## Behaviour Summary

| Gesture | Mouse/touch | Action | Color |
|---------|------------|--------|-------|
| Swipe → right | drag right | `postule` | Green overlay + ✓ POSTULER |
| Swipe ← left | drag left | `ignore` | Red overlay + ✕ IGNORER |
| Swipe ↑ up | drag up | `sauvegarde` | Yellow overlay + ⭐ SAUVEGARDER |
| Release in zone | drop past threshold | fires action, card flies out | — |
| Release out of zone | drop before threshold | card springs back | — |

**Threshold:** 40% of max displacement (≈ 120px on mobile, 160px on desktop).

**Overlay:** opacity 0→1 linearly between 0%→40% displacement. Label + icon centered on card. Does NOT appear before threshold zone.

---

## Card Deck Visual (Style A — Fan léger)

- **Top card:** full content, `z-index` highest
- **Card -1:** `rotate(3deg)` behind, slightly smaller (`scale(0.97)`)
- **Card -2:** `rotate(6deg)` behind, even smaller (`scale(0.94)`)
- Max 3 cards rendered at once (top + 2 behind)
- When top card flies out: card -1 animates to top (GSAP spring, 0.4s), card -2 moves to -1 slot, new card renders at -2

**Card content:**
- Title (bold, 1 line)
- Company · Location (muted)
- Contract type pill (violet) + duration (muted) on same row
- Short description (2 lines, line-clamp)
- Source badge (top-right, existing style)

---

## Animation (GSAP)

### Drag
- `pointer events`: `pointerdown` → `pointermove` → `pointerup`
- On `pointermove`: `gsap.set(card, { x, y, rotation: x * 0.08 })`
- Overlay opacity: `Math.min(Math.abs(x) / threshold, 1)` for horizontal, `Math.min(Math.abs(y) / threshold, 1) * (y < 0 ? 1 : 0)` for vertical (up only)
- Direction detection priority: if `y < -threshold * 0.5 && Math.abs(y) > Math.abs(x)` → upward intent, else horizontal intent based on sign of `x`

### Release — fly out
```js
gsap.to(card, {
  x: direction === 'right' ? 600 : direction === 'left' ? -600 : 0,
  y: direction === 'up' ? -600 : 0,
  rotation: direction === 'right' ? 30 : direction === 'left' ? -30 : 0,
  opacity: 0,
  duration: 0.35,
  ease: 'power2.in',
  onComplete: () => { removeCard(); revealNext() }
})
```

### Release — spring back
```js
gsap.to(card, {
  x: 0, y: 0, rotation: 0, opacity: 1,
  duration: 0.5, ease: 'elastic.out(1, 0.6)'
})
```

### Next card reveal
```js
gsap.fromTo(cardMinus1, 
  { rotation: 3, scale: 0.97 },
  { rotation: 0, scale: 1, duration: 0.4, ease: 'back.out(1.2)' }
)
```

---

## PC Mode — Toggle

- Toggle button in `/offers` page header: `[≡ Liste]` / `[◉ Swipe]`
- State persisted in `localStorage` key `offers-view-mode` (`'list'` | `'swipe'`)
- Default: `'list'` on desktop (≥ 1024px), `'swipe'` on mobile (< 1024px)
- On first load: read `localStorage`, fallback to breakpoint default
- Swipe deck on desktop: centered, max-width 420px, same GSAP behaviour with mouse events

---

## Mobile Specifics

- Touch events: `touchstart` / `touchmove` / `touchend` (use `pointer events` API which covers both)
- Deck centered full-width with `max-w-sm mx-auto`
- No filter pills visible in swipe mode (simplify mobile UX) — filters accessible via a "Filtrer" button that opens a bottom sheet
- Action buttons below deck (fallback for accessibility): ✕ ⭐ ✓ — same handlers as swipe

---

## Empty State

When deck runs out of cards:
- Show centered card: "Plus d'offres à traiter" + "Actualiser" button → re-fetches
- Same dark card style as existing empty state

---

## Components

| File | Type | Responsibility |
|------|------|---------------|
| `components/offers/SwipeDeck.tsx` | Client | Deck container — manages card stack state, fetches next batch |
| `components/offers/SwipeCard.tsx` | Client | Single card — drag logic, GSAP animations, overlay |
| `components/offers/ViewToggle.tsx` | Client | List/Swipe toggle button for desktop header |

---

## Files Modified

| File | Change |
|------|--------|
| `app/offers/page.tsx` | Add `ViewToggle`, render `SwipeDeck` or existing grid based on mode |

---

## Data / API

- Same `/api/offers` endpoint, same `onAction` callback signature as `OfferCard`
- `SwipeDeck` fetches initial 10 offers, prefetches next batch when 3 cards remain
- No new API routes needed

---

## Accessibility

- `aria-label` on deck container: "Pile d'offres, glissez pour interagir"
- Action buttons below deck visible at all times (keyboard/screen reader fallback)
- `prefers-reduced-motion`: skip GSAP animations, use instant transitions

---

## Out of Scope

- No undo/undo-stack
- No swipe history
- No keyboard swipe shortcuts
- No onboarding tutorial overlay
