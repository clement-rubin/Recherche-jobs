# Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's dark-theme residue with a coherent light visual system built on an elevation scale, a radius scale and semantic color tokens — fixing the WCAG contrast failures along the way.

**Architecture:** Tasks 1–6 build the foundation (CSS tokens, then four shared primitives) that everything else consumes. Tasks 7–15 migrate one page or feature area each onto that foundation; they are independent of one another and touch disjoint files. Task 16 is the verification pass.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind v4 (CSS-first `@import "tailwindcss"`), Jest + React Testing Library, GSAP for existing animations.

**Spec:** `docs/superpowers/specs/2026-09-09-visual-redesign-design.md`

**Read this before starting any task:** Dark mode is explicitly out of scope — never add a `prefers-color-scheme` block or theme toggle. Do not restructure layouts, move elements, or change copy; this is a visual/system pass only.

**Convention for migration tasks (7–15):** each gives you a `grep` command that lists every offending literal in scope, a mapping table from that literal to its replacement token, and a verification step re-running the grep to confirm zero matches. Apply the mapping everywhere the grep reports it — the tables are exhaustive for what the audit found, and the grep catches anything it missed.

---

## Task 1: Design tokens in `globals.css`

**Files:**
- Modify: `app/globals.css:3-24` (the `:root` block), plus the rules named in Step 3

- [ ] **Step 1: Replace the `:root` block**

Replace lines 3–24 (`:root { ... }`) in `app/globals.css` with:

```css
:root {
  /* Surfaces */
  --background: #f4f4f5;
  --surface:    #fafafa;
  --card:       #ffffff;
  --card-hover: #f9f9f9;
  --card-gradient: linear-gradient(180deg, #ffffff 0%, #fcfcfd 100%);
  --border:     #e4e4e7;
  --border-light: #d4d4d8;

  /* Brand */
  --accent:       #6366f1;
  --accent-light: #818cf8;
  --accent-hover: #4f46e5;

  /* Text */
  --foreground:     #18181b;
  --foreground-dim: #52525b;
  --muted:          #71717a;
  --muted-light:    #a1a1aa;

  /* Semantic — text values clear 4.5:1 on white and on their own surface tint */
  --success:         #16a34a;
  --success-text:    #15803d;
  --success-surface: rgba(22, 163, 74, 0.08);
  --success-border:  rgba(22, 163, 74, 0.22);

  --warning:         #d97706;
  --warning-text:    #b45309;
  --warning-surface: rgba(217, 119, 6, 0.08);
  --warning-border:  rgba(217, 119, 6, 0.22);

  --danger:         #ef4444;
  --danger-text:    #b91c1c;
  --danger-surface: rgba(239, 68, 68, 0.08);
  --danger-border:  rgba(239, 68, 68, 0.22);

  --accent-text:    #4f46e5;
  --accent-surface: rgba(99, 102, 241, 0.08);
  --accent-border:  rgba(99, 102, 241, 0.22);

  /* Elevation — two-layer, zinc-tinted so it reads warm rather than sooty */
  --shadow-xs: 0 1px 2px rgba(24, 24, 27, 0.04), 0 1px 1px rgba(24, 24, 27, 0.03);
  --shadow-sm: 0 1px 3px rgba(24, 24, 27, 0.05), 0 2px 6px rgba(24, 24, 27, 0.04);
  --shadow-md: 0 2px 6px rgba(24, 24, 27, 0.06), 0 6px 16px rgba(24, 24, 27, 0.05);
  --shadow-lg: 0 4px 12px rgba(24, 24, 27, 0.07), 0 12px 32px rgba(24, 24, 27, 0.06);
  --shadow-xl: 0 8px 24px rgba(24, 24, 27, 0.08), 0 24px 56px rgba(24, 24, 27, 0.08);
  --shadow-accent: 0 4px 16px rgba(99, 102, 241, 0.24);

  /* Radius */
  --r-sm:  6px;
  --r-md:  8px;
  --r-lg:  12px;
  --r-xl:  16px;
  --r-2xl: 20px;

  /* Motion */
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out: cubic-bezier(0.0, 0, 0.2, 1);
}
```

Note what left: `--accent-dim`, `--accent-glow` and `--radius` are gone (Task 7 and Task 11 repoint their call sites; Step 3 below handles the ones inside this file).

- [ ] **Step 2: Delete the dark `.glass` rule**

Delete this entire rule from `app/globals.css` (it is a dark navy panel in a light theme; `MobileHeader` defines its own correct light glass inline):

```css
.glass {
  background: rgba(16, 18, 32, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
}
```

- [ ] **Step 3: Repoint the violet literals and heavy shadows inside this file**

Apply these four edits in `app/globals.css`:

```css
/* was: rgba(124, 58, 237, 0) / rgba(124, 58, 237, 0.2) */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
  50%      { box-shadow: 0 0 20px 4px rgba(99, 102, 241, 0.2); }
}

/* was: box-shadow: 0 4px 20px rgba(99,102,241,0.35) */
.btn-accent:hover {
  background: var(--accent-hover);
  box-shadow: var(--shadow-accent);
  transform: translateY(-1px);
}

/* was: box-shadow: 0 6px 28px rgba(0, 0, 0, 0.35) */
.stat-card:hover {
  border-color: var(--border-light);
  box-shadow: var(--shadow-md);
  transform: translateY(-3px);
}

/* was: box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15) */
input:focus, select:focus, textarea:focus {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px var(--accent-surface) !important;
  outline: none !important;
}
```

Also update `.gradient-text` to use the brand rather than an unrelated violet/fuchsia pair:

```css
.gradient-text {
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

- [ ] **Step 4: Verify no violet literals remain in this file**

Run: `grep -n "124, 58, 237\|124,58,237\|7c3aed\|rgba(16, 18, 32" app/globals.css`
Expected: no output.

- [ ] **Step 5: Verify the app still builds and tests pass**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: no type errors; 21 suites / 97 tests pass. (No test asserts on these CSS values, so nothing should break. `--accent-dim` and `--accent-glow` are still referenced by `.nav-item:hover`, `Nav.tsx`, `WizardModal.tsx` and `analyze/page.tsx` at this point — that is expected and harmless: an undefined CSS var simply yields no background. Tasks 7 and 11 repoint them.)

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "feat: establish elevation, radius and semantic color tokens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: `Card` primitive

**Files:**
- Create: `components/ui/Card.tsx`
- Test: `__tests__/components/ui/Card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { Card } from '@/components/ui/Card'

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>contenu</Card>)
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })

  it('merges an extra className', () => {
    render(<Card className="p-8">contenu</Card>)
    expect(screen.getByText('contenu')).toHaveClass('p-8')
  })

  it('renders as a button and fires onClick when interactive', async () => {
    const onClick = jest.fn()
    render(<Card onClick={onClick}>cliquable</Card>)
    const el = screen.getByRole('button', { name: 'cliquable' })
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders as a plain div when not interactive', () => {
    render(<Card>statique</Card>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/ui/Card.test.tsx`
Expected: FAIL with "Cannot find module '@/components/ui/Card'".

- [ ] **Step 3: Implement**

```tsx
'use client'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

const BASE = 'rounded-[var(--r-xl)] border transition-shadow duration-200'

export function Card({ children, className = '', onClick }: CardProps) {
  const style = {
    background: 'var(--card-gradient)',
    borderColor: 'var(--border)',
    boxShadow: 'var(--shadow-sm)',
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${BASE} text-left w-full hover:shadow-[var(--shadow-md)] ${className}`}
        style={style}
      >
        {children}
      </button>
    )
  }

  return (
    <div className={`${BASE} ${className}`} style={style}>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/ui/Card.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Card.tsx __tests__/components/ui/Card.test.tsx
git commit -m "feat: add Card primitive on the elevation scale

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Rebuild `Badge` on semantic tokens

**Files:**
- Modify: `components/ui/Badge.tsx` (full rewrite)
- Test: `__tests__/components/ui/Badge.test.tsx`

Current state, for reference — every status uses translucent dark-mode Tailwind classes (`bg-indigo-500/20 text-indigo-300 border-indigo-500/30`) that are low-contrast on the light `--card` surface. All ten entries are replaced.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('renders the French label for a known status', () => {
    render(<Badge status="en_cours" />)
    expect(screen.getByText('En cours')).toBeInTheDocument()
  })

  it('falls back to the raw status when unknown', () => {
    render(<Badge status="statut_inconnu" />)
    expect(screen.getByText('statut_inconnu')).toBeInTheDocument()
  })

  it('uses semantic tokens rather than dark-mode Tailwind classes', () => {
    const { container } = render(<Badge status="accepte" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).not.toMatch(/\/(20|30)\b/)
    expect(el.getAttribute('style')).toContain('var(--success')
  })

  it('renders every known status with a non-empty label', () => {
    const statuses = [
      'en_cours', 'relance', 'termine', 'accepte', 'refus',
      'sans_reponse', 'non_traite', 'ignore', 'postule', 'sauvegarde',
    ]
    for (const status of statuses) {
      const { container, unmount } = render(<Badge status={status} />)
      expect(container.textContent?.trim().length).toBeGreaterThan(0)
      unmount()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/ui/Badge.test.tsx`
Expected: FAIL on the third test — the current implementation emits `bg-green-500/20` and has no inline `style`.

- [ ] **Step 3: Implement**

Replace the whole of `components/ui/Badge.tsx` with:

```tsx
type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

const statusConfig: Record<string, { label: string; tone: Tone }> = {
  en_cours:     { label: 'En cours',     tone: 'accent' },
  relance:      { label: 'Relance',      tone: 'warning' },
  termine:      { label: 'Terminé',      tone: 'neutral' },
  accepte:      { label: 'Accepté',      tone: 'success' },
  refus:        { label: 'Refus',        tone: 'danger' },
  sans_reponse: { label: 'Sans réponse', tone: 'neutral' },
  non_traite:   { label: 'À traiter',    tone: 'accent' },
  ignore:       { label: 'Ignoré',       tone: 'neutral' },
  postule:      { label: 'Postulé',      tone: 'accent' },
  sauvegarde:   { label: 'Sauvegardé',   tone: 'success' },
}

const toneStyle: Record<Tone, React.CSSProperties> = {
  accent:  { background: 'var(--accent-surface)',  color: 'var(--accent-text)',  borderColor: 'var(--accent-border)' },
  success: { background: 'var(--success-surface)', color: 'var(--success-text)', borderColor: 'var(--success-border)' },
  warning: { background: 'var(--warning-surface)', color: 'var(--warning-text)', borderColor: 'var(--warning-border)' },
  danger:  { background: 'var(--danger-surface)',  color: 'var(--danger-text)',  borderColor: 'var(--danger-border)' },
  neutral: { background: 'var(--surface)',         color: 'var(--muted)',        borderColor: 'var(--border)' },
}

export function Badge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, tone: 'neutral' as Tone }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-sm)] text-xs font-medium border"
      style={toneStyle[config.tone]}
    >
      {config.label}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/ui/Badge.test.tsx && npx jest --no-coverage`
Expected: 4 new tests pass; full suite still green.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Badge.tsx __tests__/components/ui/Badge.test.tsx
git commit -m "fix: rebuild Badge on semantic tokens for AA contrast on light surfaces

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `AsyncButton` variants

**Files:**
- Modify: `components/ui/AsyncButton.tsx:15` (props) and `:43-52` (class logic)
- Test: `__tests__/components/ui/AsyncButton.test.tsx` (append)

The existing four tests assert on labels, disabled state and timers — not class names — so they keep passing unchanged. The current implementation hardcodes `bg-indigo-500`/`600`/`400`, a second brand blue that does not match `--accent: #6366f1`.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('AsyncButton', ...)` block in `__tests__/components/ui/AsyncButton.test.tsx`:

```tsx
  it('uses the accent token for the primary variant, not hardcoded indigo', () => {
    render(<AsyncButton onClick={async () => {}}>Lancer</AsyncButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).not.toMatch(/bg-indigo-/)
    expect(btn.getAttribute('style')).toContain('var(--accent)')
  })

  it('renders a danger variant on the danger token', () => {
    render(<AsyncButton onClick={async () => {}} variant="danger">Supprimer</AsyncButton>)
    expect(screen.getByRole('button').getAttribute('style')).toContain('var(--danger')
  })

  it('renders a ghost variant with no background fill', () => {
    render(<AsyncButton onClick={async () => {}} variant="ghost">Annuler</AsyncButton>)
    const style = screen.getByRole('button').getAttribute('style') ?? ''
    expect(style).not.toContain('var(--accent)')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/ui/AsyncButton.test.tsx`
Expected: FAIL — `variant="danger"` and `"ghost"` are not valid props yet, and the primary button still emits `bg-indigo-500`.

- [ ] **Step 3: Implement**

In `components/ui/AsyncButton.tsx`, change the `variant` prop type on line 15 to:

```tsx
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
```

Then replace the `baseClass` and `stateClass` blocks (lines 43–52) with:

```tsx
  const baseClass =
    'font-semibold rounded-[var(--r-lg)] px-4 py-2 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed min-h-[40px]'

  const variantStyle: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--accent)', color: '#fff', border: '1px solid transparent' },
    secondary: { background: 'var(--card)', color: 'var(--foreground-dim)', border: '1px solid var(--border)' },
    ghost:     { background: 'transparent', color: 'var(--muted)', border: '1px solid transparent' },
    danger:    { background: 'var(--danger-surface)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)' },
  }

  const stateStyle: Partial<Record<BtnState, React.CSSProperties>> = {
    loading: { opacity: 0.75 },
    success: { background: 'var(--success-surface)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
    error:   { background: 'var(--danger-surface)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-border)' },
  }
```

And replace the `<button>` element (lines 66–74) with:

```tsx
  return (
    <button
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={`${baseClass} ${className}`}
      style={{ ...variantStyle[variant], ...(stateStyle[state] ?? {}) }}
    >
      {label[state]}
    </button>
  )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/ui/AsyncButton.test.tsx`
Expected: PASS (7 tests — 4 pre-existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add components/ui/AsyncButton.tsx __tests__/components/ui/AsyncButton.test.tsx
git commit -m "feat: add ghost and danger AsyncButton variants on tokens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: `Modal` primitive

**Files:**
- Create: `components/ui/Modal.tsx`
- Test: `__tests__/components/ui/Modal.test.tsx`

`OfferDetailModal`, `WizardModal` and `ApplicationForm` each hand-roll the same overlay + rounded card + header-with-close-button + footer chrome. This is the shared version; Tasks 9, 10 and 11 adopt it.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@/components/ui/Modal'

describe('Modal', () => {
  it('renders its title and children', () => {
    render(<Modal title="Détails" onClose={() => {}}>contenu</Modal>)
    expect(screen.getByText('Détails')).toBeInTheDocument()
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn()
    render(<Modal title="Détails" onClose={onClose}>contenu</Modal>)
    fireEvent.click(screen.getByLabelText('Fermer'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the overlay is clicked', () => {
    const onClose = jest.fn()
    render(<Modal title="Détails" onClose={onClose}>contenu</Modal>)
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when the card itself is clicked', () => {
    const onClose = jest.fn()
    render(<Modal title="Détails" onClose={onClose}>contenu</Modal>)
    fireEvent.click(screen.getByText('contenu'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose on Escape', () => {
    const onClose = jest.fn()
    render(<Modal title="Détails" onClose={onClose}>contenu</Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders a footer when given one', () => {
    render(<Modal title="Détails" onClose={() => {}} footer={<span>pied</span>}>contenu</Modal>)
    expect(screen.getByText('pied')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/ui/Modal.test.tsx`
Expected: FAIL with "Cannot find module '@/components/ui/Modal'".

- [ ] **Step 3: Implement**

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/ui/Modal.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Modal.tsx __tests__/components/ui/Modal.test.tsx
git commit -m "feat: add shared Modal primitive

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Extract `SOURCE_LABELS`

**Files:**
- Create: `lib/offers/sources.ts`
- Modify: `components/offers/OfferCard.tsx:8-14`, `components/offers/OfferDetailModal.tsx:9-15`, `components/offers/SwipeCard.tsx:13-16`
- Test: `__tests__/lib/offers/sources.test.ts`

The same map is declared three times. None of the three includes `eures`, so EURES offers currently render a raw lowercase `eures` badge instead of a label — fixed here.

- [ ] **Step 1: Write the failing test**

```ts
import { SOURCE_LABELS, sourceLabel } from '@/lib/offers/sources'

describe('sourceLabel', () => {
  it('maps every known scraper source to a display label', () => {
    expect(SOURCE_LABELS.jsearch).toBe('JSearch')
    expect(SOURCE_LABELS.apec).toBe('APEC')
    expect(SOURCE_LABELS.hellowork).toBe('HelloWork')
    expect(SOURCE_LABELS.france_travail).toBe('France Travail')
    expect(SOURCE_LABELS.eures).toBe('EURES')
    expect(SOURCE_LABELS.email).toBe('Email')
  })

  it('falls back to the raw source when unknown', () => {
    expect(sourceLabel('autre_source')).toBe('autre_source')
  })

  it('falls back to "Inconnu" when the source is null or empty', () => {
    expect(sourceLabel(null)).toBe('Inconnu')
    expect(sourceLabel('')).toBe('Inconnu')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/lib/offers/sources.test.ts`
Expected: FAIL with "Cannot find module '@/lib/offers/sources'".

- [ ] **Step 3: Implement**

Create `lib/offers/sources.ts`:

```ts
export const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  apec: 'APEC',
  hellowork: 'HelloWork',
  france_travail: 'France Travail',
  eures: 'EURES',
  email: 'Email',
}

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return 'Inconnu'
  return SOURCE_LABELS[source] ?? source
}
```

Then in each of the three components, delete the local `SOURCE_LABELS` declaration and import the shared one instead:

```ts
import { sourceLabel } from '@/lib/offers/sources'
```

- `components/offers/OfferCard.tsx` — delete lines 8–14; replace the usage at line 62 with `{sourceLabel(offer.source)}`.
- `components/offers/OfferDetailModal.tsx` — delete lines 9–15; replace the usage at line 126 with `{sourceLabel(offer.source)}`.
- `components/offers/SwipeCard.tsx` — delete lines 13–16; replace line 177 with `const sourceLabel_ = sourceLabel(offer.source)` and update its single usage below. (Rename the local to avoid shadowing the imported function.) Leave `SOURCE_BADGE` on lines 7–12 alone — Task 9 handles it.

- [ ] **Step 4: Run tests and type-check**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: no type errors; full suite green.

- [ ] **Step 5: Verify the duplication is gone**

Run: `grep -rn "SOURCE_LABELS" components/ | grep -v "import"`
Expected: no output (every remaining reference is an import).

- [ ] **Step 6: Commit**

```bash
git add lib/offers/sources.ts __tests__/lib/offers/sources.test.ts components/offers/
git commit -m "refactor: extract shared SOURCE_LABELS and add missing EURES label

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Dashboard

**Files:**
- Modify: `app/page.tsx`

Per the spec: the stat *value* renders in `--foreground` for legibility; color moves to the icon, the label and a 2px top accent rule. The current pastels (`#a78bfa` 2.5:1, `#60a5fa`, `#fbbf24` 1.8:1, `#34d399` 2:1) all fail AA as text.

- [ ] **Step 1: Find every hardcoded literal**

Run: `grep -n "#a78bfa\|#60a5fa\|#fbbf24\|#34d399\|124, 58, 237\|7c3aed\|rgba(96, 165, 250\|rgba(251, 191, 36\|rgba(52, 211, 153" app/page.tsx`
Expected: roughly 20 matches across the `statCards` array, the header gradient bar, the progress bar, the empty state and the recent-activity avatar.

- [ ] **Step 2: Replace the `statCards` color fields**

In the `statCards` array, replace each entry's `accent` / `bg` / `border` fields with a single `tone` field:

| Card | was `accent` | new `tone` |
|---|---|---|
| Total | `#a78bfa` | `'accent'` |
| En cours | `#60a5fa` | `'accent'` |
| Relances | `#fbbf24` | `'warning'` |
| Terminées | `#34d399` | `'success'` |

So each entry becomes `{ label, value, tone, icon }` — drop the `accent`, `bg` and `border` keys entirely.

- [ ] **Step 3: Rewrite the stat card JSX**

Replace the stat-card `map` block with:

```tsx
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map(({ label, value, tone, icon }, i) => (
          <Card
            key={label}
            className={`stat-card relative overflow-hidden p-5 animate-fade-up delay-${i + 1}`}
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-0.5"
              style={{ background: `var(--${tone}-text)` }}
            />
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                {label}
              </p>
              <span style={{ color: `var(--${tone}-text)` }}>{icon}</span>
            </div>
            <p
              className="text-4xl font-bold font-mono tracking-tight"
              style={{ color: 'var(--foreground)' }}
            >
              {value}
            </p>
          </Card>
        ))}
      </div>
```

Add `import { Card } from '@/components/ui/Card'` at the top of the file. Note the label loses `uppercase tracking-widest` — that convention reads dated and the spec calls for a more restrained hierarchy.

`.stat-card` stays as a className because `globals.css` targets it for the hover lift; `Card` passes `className` straight through, so that rule still applies.

- [ ] **Step 4: Replace the remaining literals in this file**

| Location | Old | New |
|---|---|---|
| Header accent bar | `linear-gradient(to bottom, #a78bfa, #7c3aed)` | `var(--accent)` |
| Progress bar — En cours | `background: '#60a5fa'` | `background: 'var(--accent-text)'` |
| Progress bar — Relances | `background: '#fbbf24'` | `background: 'var(--warning-text)'` |
| Progress bar — Terminées | `background: '#34d399'` | `background: 'var(--success-text)'` |
| Progress legend dots | same three hexes | same three tokens |
| Recent-activity header icon | `stroke="#7c3aed"` | `stroke="var(--accent)"` |
| Empty-state icon wrapper | `rgba(124, 58, 237, 0.1)` / `rgba(124, 58, 237, 0.2)` | `var(--accent-surface)` / `var(--accent-border)` |
| Empty-state icon | `stroke="#7c3aed"` | `stroke="var(--accent)"` |
| Avatar chip | `rgba(124, 58, 237, 0.1)`, `color: '#a78bfa'`, `rgba(124, 58, 237, 0.15)` | `var(--accent-surface)`, `var(--accent-text)`, `var(--accent-border)` |
| Recent-activity row hover | `hover:bg-zinc-50` | inline `onMouseEnter`/`onMouseLeave` setting `background` to `var(--surface)` / `transparent` |

Also swap the container `rounded-xl` classes on the progress panel and the recent-activity panel to `rounded-[var(--r-xl)]`, and give both `boxShadow: 'var(--shadow-sm)'`.

- [ ] **Step 5: Verify no literals remain**

Run: `grep -n "#a78bfa\|#60a5fa\|#fbbf24\|#34d399\|124, 58, 237\|7c3aed" app/page.tsx`
Expected: no output.

- [ ] **Step 6: Type-check and test**

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: no errors; full suite green.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "fix: put dashboard stat values on AA-contrast tokens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Offers list, `OfferCard`, `ViewToggle`

**Files:**
- Modify: `app/offers/page.tsx`, `components/offers/OfferCard.tsx`, `components/offers/ViewToggle.tsx`

- [ ] **Step 1: Find the literals**

Run: `grep -n "bg-red-50\|border-red-200\|text-red-700\|rgba(0, 0, 0\|rounded-xl\|rounded-lg\|hover:bg-zinc" app/offers/page.tsx components/offers/OfferCard.tsx components/offers/ViewToggle.tsx`

- [ ] **Step 2: Apply the mapping**

| Old | New |
|---|---|
| `bg-red-50 border-red-200 text-red-700` (error banner, `offers/page.tsx`) | inline style `{ background: 'var(--danger-surface)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }` |
| `boxShadow: '0 1px 3px rgba(0,0,0,0.06)'` (`OfferCard`) | `boxShadow: 'var(--shadow-sm)'`, and on hover `var(--shadow-md)` |
| `rgba(99, 102, 241, 0.2)` (source badge border, `OfferCard`) | `var(--accent-border)` |
| `hover:border-accent/40` (`OfferCard`) | inline `onMouseEnter`/`onMouseLeave` setting `borderColor` to `var(--accent-border)` / `var(--border)` |
| `rounded-xl` on cards and the empty state | `rounded-[var(--r-xl)]` |
| `rounded-lg` on buttons | `rounded-[var(--r-lg)]` |
| `hover:bg-zinc-100` / `hover:bg-zinc-50` | `var(--surface)` via inline handlers |

- [ ] **Step 3: Unify the two filter-pill rows**

`app/offers/page.tsx` has two `rounded-full` pill rows whose active state uses different colors — one `--accent`, one `--foreground`. Make both use the accent convention: active pill gets `{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }`; inactive gets `{ background: 'var(--card)', color: 'var(--muted)', borderColor: 'var(--border)' }`.

- [ ] **Step 4: Give offer cards the new elevation**

In `OfferCard.tsx`, set the card container's background to `var(--card-gradient)` and its resting shadow to `var(--shadow-sm)`, keeping the existing `-translate-y-0.5` hover lift and pairing it with `var(--shadow-md)`.

- [ ] **Step 5: Verify**

Run: `grep -n "bg-red-50\|text-red-700\|rgba(0, 0, 0\|hover:bg-zinc" app/offers/page.tsx components/offers/OfferCard.tsx components/offers/ViewToggle.tsx`
Expected: no output.

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add app/offers/page.tsx components/offers/OfferCard.tsx components/offers/ViewToggle.tsx
git commit -m "style: migrate offers list and card onto the design tokens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: `OfferDetailModal`, `SwipeCard`, `SwipeDeck`

**Files:**
- Modify: `components/offers/OfferDetailModal.tsx`, `components/offers/SwipeCard.tsx`, `components/offers/SwipeDeck.tsx`

`SwipeCard` holds the heaviest concentration of one-off inline literals in the app.

- [ ] **Step 1: Find the literals**

Run: `grep -n "rgba(0, 0, 0\|rgba(34, 197, 94\|rgba(239, 68, 68\|rgba(250, 204, 21\|#4ade80\|#f87171\|#fbbf24\|rounded-\[16px\]\|bg-indigo-50\|bg-blue-50\|bg-emerald-50\|bg-amber-50\|rgba(22, 163, 74\|rgba(99, 102, 241\|hover:bg-zinc" components/offers/OfferDetailModal.tsx components/offers/SwipeCard.tsx components/offers/SwipeDeck.tsx`

- [ ] **Step 2: Apply the mapping**

| Old | New |
|---|---|
| `rgba(34,197,94,0.25)` swipe overlay (postuler) | `var(--success-surface)` at higher alpha: `rgba(22, 163, 74, 0.18)` |
| `rgba(239,68,68,0.25)` swipe overlay (ignorer) | `rgba(239, 68, 68, 0.18)` |
| `rgba(250,204,21,0.2)` swipe overlay (sauvegarder) | `rgba(217, 119, 6, 0.18)` |
| overlay text `#4ade80` | `var(--success-text)` |
| overlay text `#f87171` | `var(--danger-text)` |
| overlay text `#fbbf24` | `var(--warning-text)` |
| `textShadow: ... rgba(0,0,0,0.3)` | delete — unnecessary now that the text is dark on a light tint |
| `0 8px 32px rgba(0,0,0,0.15)` (top card) | `var(--shadow-lg)` |
| `0 2px 8px rgba(0,0,0,0.1)` (stacked cards) | `var(--shadow-sm)` |
| `rounded-[16px]` | `rounded-[var(--r-xl)]` |
| `SOURCE_BADGE` Tailwind map (`bg-indigo-50` etc.) | delete the map; render the source pill with `{ background: 'var(--accent-surface)', color: 'var(--accent-text)', borderColor: 'var(--accent-border)' }` for every source |
| `rgba(22,163,74,0.3)` / `rgba(22,163,74,0.06)` (salary pill, `OfferDetailModal`) | `var(--success-border)` / `var(--success-surface)` |
| `rgba(99,102,241,0.3)` (remote badge border) | `var(--accent-border)` |
| `hover:bg-zinc-100` (close button) | handled by adopting `Modal` in Step 3 |
| `uppercase tracking-wide` section labels (4×) | drop both classes; keep `text-xs font-medium` with `color: var(--muted)` |

- [ ] **Step 3: Adopt the `Modal` primitive in `OfferDetailModal`**

Replace the hand-rolled overlay/card/header/footer with `<Modal title={offer.titre} onClose={onClose} footer={...}>`, moving the existing body content into its children and the existing action-button row into `footer`. Keep the meta-pill row as the first element of the body. Delete the now-unused overlay and close-button markup.

- [ ] **Step 4: Verify**

Run: `grep -n "rgba(0, 0, 0\|#4ade80\|#f87171\|#fbbf24\|rounded-\[16px\]\|SOURCE_BADGE\|uppercase tracking-wide" components/offers/OfferDetailModal.tsx components/offers/SwipeCard.tsx components/offers/SwipeDeck.tsx`
Expected: no output.

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: green — note `__tests__/components/SwipeCard.test.tsx` and `SwipeDeck.test.tsx` exist; if either asserts on a removed class name, update the assertion to match the new token-based style rather than reverting the change.

- [ ] **Step 5: Commit**

```bash
git add components/offers/
git commit -m "style: migrate offer modal and swipe deck onto tokens and shared Modal

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Candidatures

**Files:**
- Modify: `app/applications/page.tsx`, `components/applications/ApplicationForm.tsx`, `components/applications/ApplicationsTable.tsx`, `components/applications/KanbanBoard.tsx`

- [ ] **Step 1: Find the literals**

Run: `grep -n "bg-red-500/10\|border-red-500/30\|text-red-400\|hover:bg-zinc\|hover:bg-red-50\|rounded-xl\|rounded-lg\|rounded-t-2xl" app/applications/page.tsx components/applications/*.tsx`

- [ ] **Step 2: Apply the mapping**

| Old | New |
|---|---|
| `bg-red-500/10 border-red-500/30 text-red-400` (error banners — `page.tsx`, `ApplicationForm.tsx`) | inline `{ background: 'var(--danger-surface)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }` |
| `hover:bg-zinc-100` / `hover:bg-red-50` (`ApplicationsTable`) | `var(--surface)` / `var(--danger-surface)` via inline handlers |
| `×` unicode close glyph (`ApplicationForm`) | supplied by `Modal` in Step 3 |
| `rounded-xl` / `rounded-lg` | `rounded-[var(--r-xl)]` / `rounded-[var(--r-lg)]` |
| `"Sup."` abbreviated delete label (`ApplicationsTable`) | `"Supprimer"` |

- [ ] **Step 3: Adopt `Modal` in `ApplicationForm`**

Replace the hand-rolled bottom-sheet/modal chrome with `<Modal title="Nouvelle candidature" onClose={onClose} footer={...}>` (or the edit-mode title the component already computes). `Modal`'s default `sheetOnMobile` already reproduces the current `rounded-t-2xl sm:rounded-xl` behavior — do not add your own.

- [ ] **Step 4: Give the kanban columns and table container the elevation scale**

`KanbanBoard` column containers and the `ApplicationsTable` wrapper both take `background: 'var(--card-gradient)'`, `border: '1px solid var(--border)'`, `boxShadow: 'var(--shadow-sm)'`.

- [ ] **Step 5: Verify**

Run: `grep -n "text-red-400\|bg-red-500/10\|hover:bg-zinc" app/applications/page.tsx components/applications/*.tsx`
Expected: no output.

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add app/applications/page.tsx components/applications/
git commit -m "style: migrate candidatures onto tokens and shared Modal

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Recherche + `WizardModal`

**Files:**
- Modify: `app/search/page.tsx`, `components/search/WizardModal.tsx`, `components/search/wizardStyles.ts`

- [ ] **Step 1: Find the literals**

Run: `grep -n "bg-green-50\|border-green-200\|text-green-700\|hover:bg-zinc\|hover:bg-red-50\|accent-dim\|↻\|✕\|rounded-xl\|rounded-2xl" app/search/page.tsx components/search/WizardModal.tsx components/search/wizardStyles.ts`

- [ ] **Step 2: Apply the mapping**

| Old | New |
|---|---|
| `bg-green-50 border-green-200 text-green-700` (actif badge) | `{ background: 'var(--success-surface)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }` |
| `var(--accent-dim)` (wizard step progress, removed in Task 1) | `var(--accent-surface)` |
| `↻` glyph (relancer) | inline SVG: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-14.9-3M4 15a8 8 0 0014.9 3"/></svg>` |
| `✕` glyph (supprimer) | inline SVG: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M18 6L6 18M6 6l12 12"/></svg>` |
| `+` glyph (nouveau profil) | inline SVG: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4"/></svg>` |
| `hover:bg-zinc-100` / `hover:bg-red-50` | `var(--surface)` / `var(--danger-surface)` via inline handlers |
| `rounded-xl` / `rounded-2xl` | `rounded-[var(--r-xl)]` / `rounded-[var(--r-2xl)]` |
| `inputClass` in `wizardStyles.ts` — `rounded-lg` | `rounded-[var(--r-md)]` |

- [ ] **Step 3: Adopt `Modal` in `WizardModal`**

Replace the hand-rolled overlay/card/header/footer. The step-progress bar stays directly under the header as the first body element; the `Précédent`/`Suivant`/save row moves into `footer`. Keep the existing GSAP entrance animation on the inner content — do not animate `Modal` itself.

Note `WizardModal` currently renders its own title (`profile ? 'Modifier le profil' : 'Nouveau profil'`); pass that same expression as `Modal`'s `title` and delete the local header markup.

- [ ] **Step 4: Verify**

Run: `grep -n "bg-green-50\|accent-dim\|hover:bg-zinc\|↻\|✕" app/search/page.tsx components/search/WizardModal.tsx`
Expected: no output.

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: green — `__tests__/components/search/WizardModal.test.tsx` exists and asserts on step navigation; if it queries the close button or header, update the query to match `Modal`'s markup (`getByLabelText('Fermer')`).

- [ ] **Step 5: Commit**

```bash
git add app/search/page.tsx components/search/
git commit -m "style: migrate recherche and wizard onto tokens and shared Modal

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Analyser

**Files:**
- Modify: `app/analyze/page.tsx`

- [ ] **Step 1: Find the literals**

Run: `grep -n "📍\|⚠️\|✕\|accent-dim\|rounded-xl\|rgba(239, 68, 68\|rgba(217, 119, 6\|rgba(99, 102, 241" app/analyze/page.tsx`

- [ ] **Step 2: Apply the mapping**

| Old | New |
|---|---|
| `rgba(239,68,68,0.08)` + `var(--danger)` (error box) | `var(--danger-surface)` + `var(--danger-text)`, border `var(--danger-border)` |
| `rgba(217,119,6,0.08)` + `var(--warning)` (warning box) | `var(--warning-surface)` + `var(--warning-text)`, border `var(--warning-border)` |
| `rgba(99,102,241,0.08)` + `var(--accent)` (info box) | `var(--accent-surface)` + `var(--accent-text)`, border `var(--accent-border)` |
| `var(--accent-dim)` if present | `var(--accent-surface)` |
| the `Section` wrapper element | replace with `<Card className="p-5">` (add `import { Card } from '@/components/ui/Card'`) — drops the local `rounded-xl` + border + background styling |
| `✕` close glyph | inline SVG (same path as Task 11) |

- [ ] **Step 3: Replace the emoji icons with SVG**

| Emoji | Replacement |
|---|---|
| 📍 (location) | `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>` |
| ⚠️ (warning) | `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>` |

- [ ] **Step 4: Keep `ScoreGauge` legible**

The gauge's conic-gradient ring stays, but its track color becomes `var(--border)` and its inner disc `var(--card)`. If the score text sits on the accent color, move it to `var(--foreground)` — same rationale as the dashboard stat values.

- [ ] **Step 5: Verify**

Run: `grep -n "📍\|⚠️\|✕\|accent-dim" app/analyze/page.tsx`
Expected: no output.

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add app/analyze/page.tsx
git commit -m "style: migrate analyser onto tokens, replace emoji with SVG icons

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: Paramètres

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Find the literals**

Run: `grep -n "bg-green-500/10\|border-green-500/30\|bg-red-500/10\|border-red-500/30\|text-red-400\|hover:bg-indigo-700\|✓\|✗\|rounded-xl" app/settings/page.tsx`

- [ ] **Step 2: Apply the mapping**

| Old | New |
|---|---|
| `bg-green-500/10 border-green-500/30 text-success` | `{ background: 'var(--success-surface)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }` |
| `bg-red-500/10 border-red-500/30 text-red-400` | `{ background: 'var(--danger-surface)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }` |
| `hover:bg-indigo-700` | `var(--accent-hover)` via inline handler, or swap the button for `<AsyncButton variant="primary">` if it already performs an async action |
| `✓` / `✗` status glyphs | inline SVG check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>` and cross (same path as Task 11) |
| `sectionClass = "bg-card border border-border rounded-xl p-5 space-y-4"` | delete the constant; wrap each of the two sections in `<Card className="p-5 space-y-4">` (add `import { Card } from '@/components/ui/Card'`) |

- [ ] **Step 3: Verify**

Run: `grep -n "bg-green-500/10\|bg-red-500/10\|text-red-400\|hover:bg-indigo-700" app/settings/page.tsx`
Expected: no output.

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add app/settings/page.tsx
git commit -m "style: migrate paramètres onto semantic tokens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14: Login — dark to light

**Files:**
- Modify: `app/login/page.tsx`

This page uses zero CSS vars today; every color is a dark-theme literal. It becomes a light page consistent with the rest of the app.

- [ ] **Step 1: Find the literals**

Run: `grep -n "#08090e\|#1a1d32\|rgba(16, 18, 32\|#f0f0f5\|#9ca3af\|#6b7394\|#4b5175\|#7c6fa8\|7c3aed\|5b21b6\|#fb7185\|rgba(244, 63, 94\|rgba(0, 0, 0, 0.5\|rgba(124, 58, 237" app/login/page.tsx`

- [ ] **Step 2: Apply the mapping**

| Old | New |
|---|---|
| page background `#08090e` | `var(--background)` |
| card `rgba(16,18,32,0.8)` + `backdropFilter: blur(12px)` | `var(--card-gradient)`, drop the blur (nothing behind it to blur once the ambient blobs go) |
| card border `#1a1d32` | `var(--border)` |
| card shadow `0 24px 60px rgba(0,0,0,0.5)` | `var(--shadow-xl)` |
| heading text `#f0f0f5` | `var(--foreground)` |
| body text `#9ca3af` / `#6b7394` | `var(--muted)` |
| faint text `#4b5175` / `#7c6fa8` | `var(--muted-light)` |
| brand gradient `linear-gradient(135deg, #7c3aed, #5b21b6)` | `var(--accent)` |
| brand glow `0 0 30px rgba(124,58,237,0.4)` | `var(--shadow-accent)` |
| error `#fb7185` on `rgba(244,63,94,0.1)` | `var(--danger-text)` on `var(--danger-surface)` with `var(--danger-border)` |
| radial dot-grid background + ambient glow blobs | delete both — they read as dark-theme decoration and have no light-theme equivalent |
| `rounded-2xl` | `rounded-[var(--r-2xl)]` |

- [ ] **Step 3: Verify**

Run: `grep -n "#08090e\|#1a1d32\|rgba(16, 18, 32\|7c3aed\|5b21b6\|#fb7185" app/login/page.tsx`
Expected: no output.

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "style: convert login page from dark theme to the light design system

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15: À propos — dark to light

**Files:**
- Modify: `app/about/page.tsx`, plus the `AboutTabs` and `FaqAccordion` components it renders (find them with `grep -rn "AboutTabs\|FaqAccordion" components/ app/`)

- [ ] **Step 1: Find the literals**

Run: `grep -rn "#08090e\|#e8eaf5\|#8b92b8\|#6b7280\|#242847\|7c3aed\|5b21b6\|#a78bfa\|#22c55e\|#60a5fa\|rgba(124, 58, 237\|🏗️\|✅\|🎤" app/about/page.tsx components/about/`

- [ ] **Step 2: Apply the mapping**

| Old | New |
|---|---|
| page background `#08090e` | `var(--background)` |
| heading text `#e8eaf5` | `var(--foreground)` |
| body text `#8b92b8` / `#6b7280` | `var(--muted)` |
| borders `#242847`, `rgba(124,58,237,0.12)`, `rgba(124,58,237,0.15)` | `var(--border)` / `var(--accent-border)` |
| violet `#7c3aed` / `#5b21b6` / `#a78bfa` | `var(--accent)` (fills), `var(--accent-text)` (text/icons) |
| green `#22c55e` | `var(--success-text)` |
| blue `#60a5fa` | `var(--accent-text)` |
| CTA gradient button + violet glow | `var(--accent)` background + `var(--shadow-accent)` on hover |
| card `rounded-xl` / hero `rounded-2xl` | `rounded-[var(--r-xl)]` / `rounded-[var(--r-2xl)]` |
| feature/info cards | add `background: 'var(--card-gradient)'`, `border: '1px solid var(--border)'`, `boxShadow: 'var(--shadow-sm)'` |

- [ ] **Step 3: Replace the emoji icons**

The page already imports Lucide for its feature grid — use Lucide for these three too, matching the existing import style and icon sizing on that page.

| Emoji | Lucide icon |
|---|---|
| 🏗️ | `Hammer` |
| ✅ | `CircleCheck` |
| 🎤 | `Mic` |

- [ ] **Step 4: Verify**

Run: `grep -rn "#08090e\|#e8eaf5\|7c3aed\|🏗️\|✅\|🎤" app/about/page.tsx components/about/`
Expected: no output.

Run: `npx tsc --noEmit && npx jest --no-coverage`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add app/about/page.tsx components/about/
git commit -m "style: convert about page from dark theme to the light design system

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 16: Verification pass

**Files:** none modified unless a defect is found.

- [ ] **Step 1: Confirm the dark-theme residue is gone repo-wide**

Run:
```bash
grep -rn "7c3aed\|5b21b6\|#a78bfa\|#08090e\|#1a1d32\|rgba(16, 18, 32\|text-red-400\|bg-red-500/10\|bg-indigo-500\|rgba(0, 0, 0, 0.35\|rgba(0, 0, 0, 0.5" app/ components/ --include=*.tsx --include=*.css
```
Expected: no output. Any hit is a missed migration — fix it in the owning task's file and amend that task's commit area with a follow-up commit.

- [ ] **Step 2: Confirm the orphan tokens are gone**

Run: `grep -rn "accent-dim\|accent-glow\|var(--radius)" app/ components/`
Expected: no output.

- [ ] **Step 3: Full suite and type-check**

Run: `npx tsc --noEmit && npx jest --no-coverage && npm run lint`
Expected: no type errors; all suites green; no *new* lint errors (the repo has ~20 pre-existing lint errors in `app/offers/page.tsx`, `app/search/page.tsx`, `app/settings/page.tsx`, `lib/assistant/groq.ts`, `lib/email/parser.ts`, `components/ui/Badge.tsx` — compare against a baseline `npm run lint` run on `master` before claiming a regression).

- [ ] **Step 4: Visual verification in the browser**

Start the dev server via the `preview_start` tool (never `npm run dev` in a shell) and check each page at 1440px, 768px and 375px:

`/login`, `/` (dashboard), `/offers` (both list and swipe views), `/applications` (table and kanban), `/search` (including the wizard modal), `/analyze`, `/settings`, `/about`.

For each: no horizontal scroll, no element clipped behind fixed bars, modals dismissible, focus rings visible when tabbing.

- [ ] **Step 5: Contrast audit**

For every text/background pair introduced by this plan, verify ≥ 4.5:1 (≥ 3:1 for text ≥ 24px or bold ≥ 19px). At minimum check: every `Badge` tone on `--card`; the four dashboard stat cards; error/success/warning banners on offers, candidatures, settings and search; the swipe overlay labels; login error text.

Use the browser tool's `javascript_tool` to compute the ratios from the live computed styles rather than eyeballing them.

- [ ] **Step 6: Reduced motion**

With `prefers-reduced-motion: reduce` emulated, confirm animations are suppressed and no content is left invisible (the `globals.css` block force-sets `opacity: 1` for `.animate-fade-up`/`.animate-fade-in` — verify GSAP-driven entrances in `Nav`, `WizardModal` and `SwipeDeck` also settle to a visible resting state).

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in the redesign verification pass

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** elevation scale → Task 1; radius scale → Task 1; semantic tokens → Task 1; depth surfaces → Task 1 + applied per page; `.glass`/violet/`--accent-dim`/`--accent-glow` cleanup → Tasks 1, 11, 12, 16; `Modal` → Task 5 (adopted in 9, 10, 11); `Badge` → Task 3; `AsyncButton` variants → Task 4; `Card` → Task 2; `sources.ts` → Task 6; dashboard → Task 7; offers → Tasks 8–9; candidatures → Task 10; recherche → Task 11; analyser → Task 12; paramètres → Task 13; login → Task 14; about → Task 15; accessibility requirements → Task 16 Steps 5–6; testing requirements → per-task test steps + Task 16. No spec section is unimplemented.
- **Placeholder scan:** none — every step carries either literal code or an exhaustive mapping table plus a grep that proves completion.
- **Type consistency:** `Card` takes `{ children, className?, onClick? }`; `Modal` takes `{ title, onClose, children, footer?, sheetOnMobile?, className? }` and is consumed with exactly those props in Tasks 9–11; `Badge` keeps its `{ status }` signature so no call site changes; `AsyncButton`'s `variant` union is widened in Task 4 before Task 13 uses `variant="primary"`; `sourceLabel(source: string | null | undefined): string` is defined in Task 6 and called with `offer.source` (typed `string | null`) in the same task.
- **`Card` consumers:** Task 7 (dashboard stat cards), Task 12 (`Section` wrappers in analyser), Task 13 (the two settings sections). A first draft of this plan created `Card` and then re-applied the same surface inline on every page — dead code. Those three tasks now import it. Other surfaces (offer cards, kanban columns, the table wrapper) keep bespoke styling because they carry hover-lift, drag, and overflow behavior that does not fit a shared wrapper; they consume the same tokens directly.
- **Known risk:** several page tasks replace Tailwind `hover:` classes with inline `onMouseEnter`/`onMouseLeave` handlers, because the surrounding code styles via inline `style` and CSS vars rather than Tailwind config. This is consistent with the existing codebase but is more verbose. If a task's diff ends up dominated by hover handlers, prefer adding a small utility class to `globals.css` (e.g. `.row-hover:hover { background: var(--surface) }`) and note it for the remaining tasks.
