# UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign JobTrackeria from dark-navy to zinc light mode with GSAP animations, fixing broken hover states, replacing the CSV keyword input with tag pills, adding qualifications + contract duration fields, and replacing native selects/confirm dialogs with custom components.

**Architecture:** Introduce 4 reusable UI primitives (TagInput, AsyncButton, InlineConfirm, MobileHeader), then refactor each page to use them. DB migration adds 2 columns to `search_profiles`. All GSAP animations are wrapped in `useEffect` to avoid SSR issues.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (config v3 style), GSAP 3, Jest + @testing-library/react, Supabase

---

## File Map

**Create:**
- `components/ui/TagInput.tsx` — reusable tag-pill input (mots-clés + qualifications)
- `components/ui/AsyncButton.tsx` — button with idle/loading/success/error states
- `components/ui/InlineConfirm.tsx` — inline red confirm banner (replaces window.confirm)
- `components/search/ProfileModal.tsx` — modal wrapper for profile create/edit form
- `components/layout/MobileHeader.tsx` — fixed top bar + hamburger for mobile
- `__tests__/components/ui/TagInput.test.tsx`
- `__tests__/components/ui/AsyncButton.test.tsx`
- `__tests__/components/ui/InlineConfirm.test.tsx`

**Modify:**
- `app/globals.css` — swap dark vars → zinc light vars, fix `.nav-item:hover`
- `components/layout/Nav.tsx` — hover classes, `lg:flex hidden` for mobile
- `components/layout/AppShell.tsx` — include MobileHeader
- `app/search/page.tsx` — use ProfileModal + AsyncButton
- `app/offers/page.tsx` — pill filter buttons
- `components/offers/OfferCard.tsx` — zinc theme + InlineConfirm
- `components/applications/ApplicationsTable.tsx` — zinc theme + InlineConfirm
- `lib/supabase/types.ts` — add qualifications + duree_contrat to SearchProfile
- `lib/scrapers/jsearch.ts` — append qualifications to query

**No changes needed:**
- `app/api/search-profiles/route.ts` — already passes body through with spread
- `app/api/search-profiles/[id]/route.ts` — same

---

## Task 1: DB Migration + Types

**Files:**
- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Run SQL migration in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → New query → paste and run:

```sql
ALTER TABLE search_profiles
  ADD COLUMN IF NOT EXISTS qualifications text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duree_contrat text DEFAULT 'peu_importe';
```

Expected: "Success. No rows returned"

- [ ] **Step 2: Update SearchProfile type**

In `lib/supabase/types.ts`, replace the `SearchProfile` interface:

```typescript
export interface SearchProfile {
  id: string
  user_id: string
  nom: string | null
  actif: boolean
  type_contrat: string[] | null
  mots_cles: string[] | null
  qualifications: string[] | null
  duree_contrat: 'peu_importe' | '1_3_mois' | '3_6_mois' | '6_plus' | null
  localisation: string | null
  rayon_km: number
  salaire_min: number | null
  created_at: string
}
```

Also update the `Database` type's `search_profiles` Insert shape (line ~94):

```typescript
search_profiles: {
  Row: SearchProfile
  Insert: Omit<SearchProfile, 'id' | 'created_at'>
  Update: Partial<Omit<SearchProfile, 'id' | 'user_id'>>
  Relationships: []
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add qualifications and duree_contrat to SearchProfile type"
```

---

## Task 2: Install GSAP

**Files:** `package.json` (via npm)

- [ ] **Step 1: Install GSAP**

```bash
npm install gsap
npm install --save-dev @types/gsap
```

Note: `@types/gsap` may not exist — GSAP ships its own types. If the install fails, skip it:

```bash
npm install gsap
```

- [ ] **Step 2: Verify**

```bash
node -e "require('gsap'); console.log('gsap ok')"
```

Expected: `gsap ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install gsap"
```

---

## Task 3: Light Theme (globals.css)

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace CSS variables**

Replace the entire `:root { ... }` block (lines 5–24) with:

```css
:root {
  --background: #f4f4f5;
  --surface:    #fafafa;
  --card:       #ffffff;
  --card-hover: #f9f9f9;
  --border:     #e4e4e7;
  --border-light: #d4d4d8;
  --accent:     #6366f1;
  --accent-light: #818cf8;
  --accent-dim: rgba(99, 102, 241, 0.1);
  --accent-glow: 0 0 20px rgba(99, 102, 241, 0.15);
  --foreground: #18181b;
  --foreground-dim: #52525b;
  --muted:      #71717a;
  --muted-light: #a1a1aa;
  --success:    #16a34a;
  --warning:    #d97706;
  --danger:     #ef4444;
  --radius: 10px;
}
```

- [ ] **Step 2: Remove dark background effects**

Delete the `body::before` block (dot grid) and `body::after` block (ambient glow) entirely — lines ~39–61 in the original file.

- [ ] **Step 3: Fix nav hover (missing rule)**

After the `.nav-item { transition: ... }` block, add:

```css
.nav-item:hover {
  background: var(--accent-dim);
  color: var(--foreground);
}

.nav-item-logout:hover {
  background: rgba(239, 68, 68, 0.08) !important;
  color: #ef4444 !important;
}
```

- [ ] **Step 4: Update body text color**

The `body` rule currently sets `color: var(--foreground)` — this is already correct, no change needed. Verify the background is also correct:

```css
body {
  background-color: var(--background);  /* now #f4f4f5 */
  color: var(--foreground);             /* now #18181b */
  ...
}
```

- [ ] **Step 5: Update btn-accent for light mode**

Replace the `.btn-accent` block:

```css
.btn-accent {
  background: var(--accent);
  box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3);
  transition: box-shadow 0.2s, transform 0.15s, background 0.15s;
}
.btn-accent:hover {
  background: #4f46e5;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
}
.btn-accent:active {
  transform: translateY(0);
}
```

- [ ] **Step 6: Verify app renders**

```bash
npm run dev
```

Open http://localhost:3000 — page should now have zinc-gray background with white cards. Nav may look off until Task 4.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css
git commit -m "feat: switch to zinc light mode theme"
```

---

## Task 4: TagInput Component

**Files:**
- Create: `components/ui/TagInput.tsx`
- Create: `__tests__/components/ui/TagInput.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/ui/TagInput.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput } from '@/components/ui/TagInput'

describe('TagInput', () => {
  it('renders existing tags', () => {
    render(<TagInput value={['logistique', 'entrepôt']} onChange={() => {}} />)
    expect(screen.getByText('logistique')).toBeInTheDocument()
    expect(screen.getByText('entrepôt')).toBeInTheDocument()
  })

  it('adds tag on Enter key', async () => {
    const onChange = jest.fn()
    render(<TagInput value={[]} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'cariste{enter}')
    expect(onChange).toHaveBeenCalledWith(['cariste'])
  })

  it('adds tag on comma key', async () => {
    const onChange = jest.fn()
    render(<TagInput value={[]} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'cariste,')
    expect(onChange).toHaveBeenCalledWith(['cariste'])
  })

  it('removes tag when × clicked', async () => {
    const onChange = jest.fn()
    render(<TagInput value={['logistique']} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Supprimer logistique'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('does not add empty or duplicate tags', async () => {
    const onChange = jest.fn()
    render(<TagInput value={['logistique']} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '{enter}')
    await userEvent.type(input, 'logistique{enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('adds suggestion tag when clicked', async () => {
    const onChange = jest.fn()
    render(
      <TagInput
        value={[]}
        onChange={onChange}
        suggestions={['magasinier', 'cariste']}
      />
    )
    await userEvent.click(screen.getByText('magasinier'))
    expect(onChange).toHaveBeenCalledWith(['magasinier'])
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/components/ui/TagInput.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/components/ui/TagInput'`

- [ ] **Step 3: Implement TagInput**

Create `components/ui/TagInput.tsx`:

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  tagColor?: 'indigo' | 'blue'
  className?: string
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Tapez + Entrée...',
  tagColor = 'indigo',
  className = '',
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const tagStyles = {
    indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
  }

  const addTag = (tag: string) => {
    const trimmed = tag.trim().replace(/,$/, '').trim()
    if (!trimmed || value.includes(trimmed)) return
    const newTags = [...value, trimmed]
    onChange(newTags)
    setInputValue('')
    // Animate new tag in
    requestAnimationFrame(() => {
      const lastTag = containerRef.current?.querySelector('[data-tag]:last-of-type')
      if (lastTag) gsap.from(lastTag, { scale: 0.7, opacity: 0, duration: 0.15, ease: 'back.out(1.7)' })
    })
  }

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    }
    if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (v.endsWith(',')) {
      addTag(v)
    } else {
      setInputValue(v)
    }
  }

  const visibleSuggestions = suggestions.filter(s => !value.includes(s))

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="flex flex-wrap gap-1.5 min-h-[38px] items-center p-1.5 bg-[#fafafa] border border-zinc-200 rounded-lg focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
      >
        {value.map(tag => (
          <span
            key={tag}
            data-tag
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${tagStyles[tagColor]}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Supprimer ${tag}`}
              className="opacity-40 hover:opacity-80 transition-opacity ml-0.5 text-sm leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
        />
      </div>
      {visibleSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-xs text-zinc-400 self-center">Suggestions :</span>
          {visibleSuggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="text-xs border border-dashed border-indigo-200 text-indigo-500 rounded px-2 py-0.5 hover:bg-indigo-50 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/components/ui/TagInput.test.tsx --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ui/TagInput.tsx __tests__/components/ui/TagInput.test.tsx
git commit -m "feat: add TagInput component with tag pills and suggestions"
```

---

## Task 5: AsyncButton Component

**Files:**
- Create: `components/ui/AsyncButton.tsx`
- Create: `__tests__/components/ui/AsyncButton.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/ui/AsyncButton.test.tsx`:

```typescript
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AsyncButton } from '@/components/ui/AsyncButton'

jest.useFakeTimers()

describe('AsyncButton', () => {
  it('renders idle label', () => {
    render(<AsyncButton onClick={async () => {}}>Lancer</AsyncButton>)
    expect(screen.getByText('Lancer')).toBeInTheDocument()
  })

  it('shows loading state during async operation', async () => {
    let resolve: () => void
    const promise = new Promise<void>(r => { resolve = r })
    render(
      <AsyncButton onClick={() => promise} loadingLabel="Chargement...">
        Lancer
      </AsyncButton>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Chargement...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    await act(async () => { resolve!() })
  })

  it('shows success state after resolve, resets after 3s', async () => {
    render(
      <AsyncButton onClick={async () => {}} successLabel="✓ Fait">
        Lancer
      </AsyncButton>
    )
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    expect(screen.getByText('✓ Fait')).toBeInTheDocument()
    act(() => { jest.advanceTimersByTime(3000) })
    expect(screen.getByText('Lancer')).toBeInTheDocument()
  })

  it('shows error state after reject, resets after 3s', async () => {
    render(
      <AsyncButton onClick={async () => { throw new Error('API down') }} errorLabel="✕ Erreur">
        Lancer
      </AsyncButton>
    )
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    expect(screen.getByText('✕ Erreur')).toBeInTheDocument()
    act(() => { jest.advanceTimersByTime(3000) })
    expect(screen.getByText('Lancer')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest __tests__/components/ui/AsyncButton.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/components/ui/AsyncButton'`

- [ ] **Step 3: Implement AsyncButton**

Create `components/ui/AsyncButton.tsx`:

```typescript
'use client'

import { useState } from 'react'

type BtnState = 'idle' | 'loading' | 'success' | 'error'

interface AsyncButtonProps {
  onClick: () => Promise<void>
  children: React.ReactNode
  loadingLabel?: string
  successLabel?: string
  errorLabel?: string
  className?: string
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export function AsyncButton({
  onClick,
  children,
  loadingLabel = 'Chargement...',
  successLabel = '✓ Succès',
  errorLabel = '✕ Erreur',
  className = '',
  disabled = false,
  variant = 'primary',
}: AsyncButtonProps) {
  const [state, setState] = useState<BtnState>('idle')

  const handleClick = async () => {
    if (state !== 'idle') return
    setState('loading')
    try {
      await onClick()
      setState('success')
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const baseClass = variant === 'primary'
    ? 'text-white font-semibold rounded-lg px-4 py-2 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed'
    : 'border border-zinc-200 text-zinc-600 rounded-lg px-4 py-2 text-sm transition-all hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed'

  const stateClass = {
    idle: variant === 'primary' ? 'bg-indigo-500 hover:bg-indigo-600' : '',
    loading: variant === 'primary' ? 'bg-indigo-400' : '',
    success: variant === 'primary' ? 'bg-green-600' : 'text-green-600 border-green-200',
    error: variant === 'primary' ? 'bg-red-500' : 'text-red-500 border-red-200',
  }

  const label = {
    idle: children,
    loading: (
      <span className="flex items-center gap-2 justify-center">
        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        {loadingLabel}
      </span>
    ),
    success: successLabel,
    error: errorLabel,
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={`${baseClass} ${stateClass[state]} ${className}`}
    >
      {label[state]}
    </button>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest __tests__/components/ui/AsyncButton.test.tsx --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ui/AsyncButton.tsx __tests__/components/ui/AsyncButton.test.tsx
git commit -m "feat: add AsyncButton with idle/loading/success/error states"
```

---

## Task 6: InlineConfirm Component

**Files:**
- Create: `components/ui/InlineConfirm.tsx`
- Create: `__tests__/components/ui/InlineConfirm.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/ui/InlineConfirm.test.tsx`:

```typescript
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineConfirm } from '@/components/ui/InlineConfirm'

jest.useFakeTimers()

describe('InlineConfirm', () => {
  it('does not render when visible=false', () => {
    render(<InlineConfirm visible={false} message="Supprimer ?" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText('Supprimer ?')).not.toBeInTheDocument()
  })

  it('renders message and buttons when visible=true', () => {
    render(<InlineConfirm visible={true} message="Supprimer ?" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Supprimer ?')).toBeInTheDocument()
    expect(screen.getByText('Confirmer')).toBeInTheDocument()
    expect(screen.getByText('Annuler')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm clicked', async () => {
    const onConfirm = jest.fn()
    render(<InlineConfirm visible={true} message="Supprimer ?" onConfirm={onConfirm} onCancel={() => {}} />)
    await userEvent.click(screen.getByText('Confirmer'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = jest.fn()
    render(<InlineConfirm visible={true} message="Supprimer ?" onConfirm={() => {}} onCancel={onCancel} />)
    await userEvent.click(screen.getByText('Annuler'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('auto-cancels after 5 seconds', async () => {
    const onCancel = jest.fn()
    render(<InlineConfirm visible={true} message="Supprimer ?" onConfirm={() => {}} onCancel={onCancel} />)
    act(() => { jest.advanceTimersByTime(5000) })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest __tests__/components/ui/InlineConfirm.test.tsx --no-coverage
```

- [ ] **Step 3: Implement InlineConfirm**

Create `components/ui/InlineConfirm.tsx`:

```typescript
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
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest __tests__/components/ui/InlineConfirm.test.tsx --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ui/InlineConfirm.tsx __tests__/components/ui/InlineConfirm.test.tsx
git commit -m "feat: add InlineConfirm component (replaces window.confirm)"
```

---

## Task 7: Nav — Hover States + Mobile

**Files:**
- Modify: `components/layout/Nav.tsx`
- Create: `components/layout/MobileHeader.tsx`
- Modify: `components/layout/AppShell.tsx`

- [ ] **Step 1: Update Nav.tsx**

Replace the entire content of `components/layout/Nav.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

const navItems = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/applications',
    label: 'Candidatures',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/offers',
    label: 'Offres',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/search',
    label: 'Recherche',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Paramètres',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function Nav({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!navRef.current) return
    const items = navRef.current.querySelectorAll('.nav-item')
    gsap.from(items, { x: -10, opacity: 0, stagger: 0.04, duration: 0.3, ease: 'power2.out' })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      ref={navRef}
      className="flex flex-col h-full w-56 bg-white border-r border-zinc-200"
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <p className="text-zinc-900 font-bold text-sm leading-none">JobTracker</p>
          <p className="text-zinc-400 text-xs mt-0.5 leading-none">IA</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-zinc-400 hover:text-zinc-600 lg:hidden">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <span className={active ? 'text-indigo-500' : 'text-zinc-400'}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </div>

      {/* Footer — logout */}
      <div className="p-2 border-t border-zinc-100">
        <button
          onClick={handleLogout}
          className="nav-item nav-item-logout w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors text-left"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Déconnexion
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create MobileHeader.tsx**

Create `components/layout/MobileHeader.tsx`:

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { Nav } from './Nav'

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!drawerRef.current || !overlayRef.current) return
    if (open) {
      gsap.fromTo(drawerRef.current, { x: -240 }, { x: 0, duration: 0.25, ease: 'power2.out' })
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    }
  }, [open])

  const handleClose = () => {
    if (!drawerRef.current || !overlayRef.current) { setOpen(false); return }
    gsap.to(drawerRef.current, { x: -240, duration: 0.2, ease: 'power2.in', onComplete: () => setOpen(false) })
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.15 })
  }

  return (
    <>
      {/* Top bar — mobile only */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-zinc-200 flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          aria-label="Ouvrir le menu"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-bold text-sm text-zinc-900">JobTracker</span>
        </div>
      </header>

      {/* Drawer overlay */}
      {open && (
        <div
          ref={overlayRef}
          className="lg:hidden fixed inset-0 z-50 bg-zinc-900/30"
          onClick={handleClose}
        >
          <div
            ref={drawerRef}
            className="absolute left-0 top-0 bottom-0 w-56 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <Nav onClose={handleClose} />
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Update AppShell.tsx**

Open `components/layout/AppShell.tsx`. Add MobileHeader import and render it. Locate where `<Nav />` is rendered (inside the authenticated branch) and update the layout:

```typescript
// Add import at top:
import { MobileHeader } from './MobileHeader'

// Inside the authenticated layout, replace the existing structure with:
<div className="flex min-h-screen">
  {/* Desktop sidebar */}
  <div className="hidden lg:flex lg:flex-col lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:w-56 lg:z-30">
    <Nav />
  </div>
  {/* Mobile header */}
  <MobileHeader />
  {/* Main content */}
  <main className="flex-1 lg:ml-56 pt-0 lg:pt-0">
    <div className="pt-14 lg:pt-0">
      {children}
      {isAuthenticated && <AssistantBubble />}
    </div>
  </main>
</div>
```

**Replace entire `components/layout/AppShell.tsx` with:**

```typescript
'use client'

import { usePathname } from 'next/navigation'
import { Nav } from './Nav'
import { AssistantBubble } from '../assistant/AssistantBubble'
import { MobileHeader } from './MobileHeader'

const PUBLIC_PATHS = ['/login', '/auth']

export function AppShell({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  if (!isAuthenticated || isPublic) {
    return <div>{children}</div>
  }

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <div className="hidden lg:flex lg:flex-col lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:w-56 lg:z-30">
        <Nav />
      </div>
      <MobileHeader />
      <main className="flex-1 lg:ml-56 p-6 min-h-screen">
        <div className="pt-8 lg:pt-0">
          {children}
        </div>
      </main>
      <AssistantBubble />
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

- Desktop (≥ 1024px): white sidebar visible, hover = zinc-100, logout hover = red
- Mobile (< 1024px): top bar visible, hamburger opens drawer from left

- [ ] **Step 5: Commit**

```bash
git add components/layout/Nav.tsx components/layout/MobileHeader.tsx components/layout/AppShell.tsx
git commit -m "feat: fix nav hover states, add mobile hamburger drawer"
```

---

## Task 8: ProfileModal + Search Page Refactor

**Files:**
- Create: `components/search/ProfileModal.tsx`
- Modify: `app/search/page.tsx`

- [ ] **Step 1: Create ProfileModal.tsx**

Create `components/search/ProfileModal.tsx`:

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type { SearchProfile } from '@/lib/supabase/types'
import { TagInput } from '@/components/ui/TagInput'

const CONTRACT_TYPES = ['interim', 'stage', 'cdi', 'cdd', 'alternance']
const DURATION_OPTIONS = [
  { value: 'peu_importe', label: 'Peu importe' },
  { value: '1_3_mois', label: '1–3 mois' },
  { value: '3_6_mois', label: '3–6 mois' },
  { value: '6_plus', label: '> 6 mois' },
]
const KEYWORD_SUGGESTIONS = [
  'magasinier', 'préparateur de commandes', 'cariste', 'manutention',
  'agent logistique', 'chauffeur livreur', 'opérateur production',
]
const QUALIFICATION_SUGGESTIONS = [
  'Permis B', 'Permis C', 'Port de charges', 'Horaires décalés',
  '2x8/3x8', 'Travail de nuit', 'Travail weekend', 'Débutant accepté',
]

interface ProfileModalProps {
  profile?: SearchProfile | null
  onSave: (data: Partial<SearchProfile>) => Promise<void>
  onClose: () => void
}

export function ProfileModal({ profile, onSave, onClose }: ProfileModalProps) {
  const [form, setForm] = useState({
    nom: profile?.nom ?? '',
    localisation: profile?.localisation ?? 'Lille',
    rayon_km: profile?.rayon_km ?? 30,
    mots_cles: profile?.mots_cles ?? [],
    qualifications: profile?.qualifications ?? [],
    type_contrat: profile?.type_contrat ?? [] as string[],
    duree_contrat: profile?.duree_contrat ?? 'peu_importe',
    salaire_min: profile?.salaire_min ? String(profile.salaire_min) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cardRef.current) {
      gsap.from(cardRef.current, { scale: 0.95, opacity: 0, duration: 0.2, ease: 'power2.out' })
    }
  }, [])

  const toggleContract = (ct: string) => {
    setForm(f => ({
      ...f,
      type_contrat: f.type_contrat.includes(ct)
        ? f.type_contrat.filter(c => c !== ct)
        : [...f.type_contrat, ct],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        nom: form.nom,
        localisation: form.localisation,
        rayon_km: Number(form.rayon_km),
        mots_cles: form.mots_cles,
        qualifications: form.qualifications,
        type_contrat: form.type_contrat,
        duree_contrat: form.duree_contrat as SearchProfile['duree_contrat'],
        salaire_min: form.salaire_min ? Number(form.salaire_min) : null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
  const labelClass = "block text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-1.5"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/30"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={cardRef} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-5 border-b border-zinc-100">
            <h2 className="text-zinc-900 font-bold text-lg">
              {profile ? 'Modifier le profil' : 'Nouveau profil'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Nom */}
            <div>
              <label className={labelClass}>Nom du profil</label>
              <input
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="Ex: Intérim Lille 2026"
                className={inputClass}
              />
            </div>

            {/* Localisation + Rayon */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className={labelClass}>Localisation</label>
                <input
                  value={form.localisation}
                  onChange={e => setForm(f => ({ ...f, localisation: e.target.value }))}
                  placeholder="Lille"
                  className={inputClass}
                />
              </div>
              <div className="text-zinc-400 text-sm pb-2">dans</div>
              <div className="w-24">
                <label className={labelClass}>Rayon</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.rayon_km}
                    onChange={e => setForm(f => ({ ...f, rayon_km: Number(e.target.value) }))}
                    className={inputClass + ' pr-8'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">km</span>
                </div>
              </div>
            </div>

            {/* Mots-clés */}
            <div>
              <label className={labelClass}>Mots-clés <span className="normal-case font-normal text-zinc-400">— intitulés, secteurs</span></label>
              <TagInput
                value={form.mots_cles ?? []}
                onChange={tags => setForm(f => ({ ...f, mots_cles: tags }))}
                suggestions={KEYWORD_SUGGESTIONS}
                placeholder="Tapez + Entrée..."
                tagColor="indigo"
              />
            </div>

            {/* Qualifications */}
            <div>
              <label className={labelClass}>Qualifications <span className="normal-case font-normal text-zinc-400">— filtrent les offres</span></label>
              <TagInput
                value={form.qualifications ?? []}
                onChange={tags => setForm(f => ({ ...f, qualifications: tags }))}
                suggestions={QUALIFICATION_SUGGESTIONS}
                placeholder="Ex: Permis B..."
                tagColor="blue"
              />
            </div>

            {/* Contrat + Durée */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Types de contrat</label>
                <div className="flex flex-wrap gap-1.5">
                  {CONTRACT_TYPES.map(ct => (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => toggleContract(ct)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors capitalize ${
                        form.type_contrat.includes(ct)
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600'
                      }`}
                    >
                      {ct}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Durée mission</label>
                <select
                  value={form.duree_contrat}
                  onChange={e => setForm(f => ({ ...f, duree_contrat: e.target.value }))}
                  className={inputClass}
                >
                  {DURATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Salaire */}
            <div>
              <label className={labelClass}>Salaire minimum</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.salaire_min}
                  onChange={e => setForm(f => ({ ...f, salaire_min: e.target.value }))}
                  placeholder="1500"
                  className={inputClass}
                />
                <span className="text-zinc-400 text-sm whitespace-nowrap">€ / mois</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-600 text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="flex gap-3 p-5 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-2 flex-[2] bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Refactor app/search/page.tsx**

Replace the entire file content:

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { gsap } from 'gsap'
import type { SearchProfile } from '@/lib/supabase/types'
import { ProfileModal } from '@/components/search/ProfileModal'
import { AsyncButton } from '@/components/ui/AsyncButton'
import { InlineConfirm } from '@/components/ui/InlineConfirm'

export default function SearchPage() {
  const [profiles, setProfiles] = useState<SearchProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editProfile, setEditProfile] = useState<SearchProfile | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const loadProfiles = useCallback(async () => {
    const res = await fetch('/api/search-profiles')
    if (res.ok) setProfiles(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  useEffect(() => {
    if (!loading && listRef.current) {
      const cards = listRef.current.querySelectorAll('.profile-card')
      if (cards.length > 0) {
        gsap.from(cards, { y: 8, opacity: 0, stagger: 0.06, duration: 0.3, ease: 'power2.out' })
      }
    }
  }, [loading, profiles.length])

  const handleCreate = async (data: Partial<SearchProfile>) => {
    const res = await fetch('/api/search-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur création')
    await loadProfiles()
  }

  const handleUpdate = async (id: string, data: Partial<SearchProfile>) => {
    const res = await fetch(`/api/search-profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur mise à jour')
    await loadProfiles()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/search-profiles/${id}`, { method: 'DELETE' })
    setProfiles(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  const handleFetchNow = async () => {
    setFetchError(null)
    const res = await fetch('/api/jobs/fetch', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur API')
    return data
  }

  if (loading) return <div className="h-64 bg-white rounded-xl animate-pulse border border-zinc-200" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Recherche</h1>
          <p className="text-zinc-500 text-sm mt-1">Configurez vos profils de recherche d&apos;emploi</p>
        </div>
        <div className="flex gap-2.5">
          <AsyncButton
            onClick={handleFetchNow}
            variant="secondary"
            loadingLabel="Recherche..."
            successLabel="✓ Offres ajoutées"
            errorLabel="✕ Erreur API"
          >
            ↻ Lancer maintenant
          </AsyncButton>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Nouveau profil
          </button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-900 font-medium mb-1">Aucun profil de recherche</p>
          <p className="text-zinc-400 text-sm">Créez un profil pour commencer à scraper des offres.</p>
        </div>
      ) : (
        <div ref={listRef} className="space-y-3">
          {profiles.map(profile => (
            <div key={profile.id} className="profile-card bg-white border border-zinc-200 rounded-xl p-4 hover:shadow-sm hover:border-zinc-300 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-zinc-900 font-semibold">{profile.nom || 'Profil sans nom'}</h3>
                    {profile.actif && (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        Actif
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-sm mt-0.5">
                    {profile.localisation} · {profile.rayon_km}km
                    {profile.duree_contrat && profile.duree_contrat !== 'peu_importe' && (
                      <span className="ml-2 text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                        {({ '1_3_mois': '1–3 mois', '3_6_mois': '3–6 mois', '6_plus': '>6 mois' } as Record<string, string>)[profile.duree_contrat]}
                      </span>
                    )}
                  </p>
                  {(profile.mots_cles ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(profile.mots_cles ?? []).map(k => (
                        <span key={k} className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-md">{k}</span>
                      ))}
                    </div>
                  )}
                  {(profile.qualifications ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(profile.qualifications ?? []).map(q => (
                        <span key={q} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-md">{q}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleUpdate(profile.id, { actif: !profile.actif })}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      profile.actif
                        ? 'border-green-200 text-green-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                        : 'border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {profile.actif ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => setEditProfile(profile)}
                    className="text-zinc-400 hover:text-indigo-500 text-xs px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Éditer
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(profile.id)}
                    className="text-zinc-400 hover:text-red-500 text-xs px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              <InlineConfirm
                visible={confirmDeleteId === profile.id}
                message={`Supprimer "${profile.nom || 'ce profil'}" ?`}
                onConfirm={() => handleDelete(profile.id)}
                onCancel={() => setConfirmDeleteId(null)}
              />
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <ProfileModal onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
      {editProfile && (
        <ProfileModal
          profile={editProfile}
          onSave={(data) => handleUpdate(editProfile.id, data)}
          onClose={() => setEditProfile(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Navigate to `/search`:
- "Nouveau profil" button → opens modal with tag pills + qualifications + durée
- "× Supprimer" → shows InlineConfirm inline (no browser confirm dialog)
- "↻ Lancer maintenant" → shows spinner then success/error

- [ ] **Step 4: Commit**

```bash
git add components/search/ProfileModal.tsx app/search/page.tsx
git commit -m "feat: search page — ProfileModal with TagInput, qualifications, duree_contrat"
```

---

## Task 9: Update jsearch.ts (qualifications in query)

**Files:**
- Modify: `lib/scrapers/jsearch.ts`

- [ ] **Step 1: Update fetchJSearch signature**

Replace `lib/scrapers/jsearch.ts`:

```typescript
export interface ScrapedJob {
  titre: string
  entreprise: string | null
  lien: string | null
  localisation: string | null
  source: string
  type_contrat: string | null
  salaire_min: number | null
  salaire_max: number | null
  raw_data: Record<string, unknown>
}

export async function fetchJSearch(
  keywords: string,
  location: string,
  qualifications: string[] = []
): Promise<ScrapedJob[]> {
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('RAPIDAPI_KEY not set, skipping JSearch')
    return []
  }

  const allKeywords = qualifications.length > 0
    ? `${keywords} ${qualifications.join(' ')} ${location}`
    : `${keywords} ${location}`

  const res = await fetch(
    `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(allKeywords)}&country=fr&num_pages=2`,
    {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    }
  )

  if (!res.ok) {
    throw new Error(`JSearch failed: ${res.status}`)
  }

  const { data = [] } = await res.json()
  return data.map((j: Record<string, unknown>) => ({
    titre: (j.job_title as string) ?? 'Poste inconnu',
    entreprise: (j.employer_name as string) ?? null,
    lien: (j.job_apply_link as string) ?? null,
    localisation: (j.job_city as string) ?? location,
    source: 'jsearch',
    type_contrat: (j.job_employment_type as string) ?? null,
    salaire_min: (j.job_min_salary as number) ?? null,
    salaire_max: (j.job_max_salary as number) ?? null,
    raw_data: j,
  }))
}
```

- [ ] **Step 2: Update fetch route to pass qualifications**

In `app/api/jobs/fetch/route.ts`, line 77, replace:

```typescript
      fetchJSearch(keywords, location),
```

with:

```typescript
      fetchJSearch(keywords, location, profile.qualifications ?? []),
```

- [ ] **Step 3: Commit**

```bash
git add lib/scrapers/jsearch.ts app/api/jobs/fetch/route.ts
git commit -m "feat: pass qualifications to JSearch query"
```

---

## Task 10: Offers Page — Pill Filters + OfferCard

**Files:**
- Modify: `app/offers/page.tsx`
- Modify: `components/offers/OfferCard.tsx`

- [ ] **Step 1: Replace OfferCard.tsx**

```typescript
'use client'

import { useState } from 'react'
import { gsap } from 'gsap'
import type { Offer } from '@/lib/supabase/types'
import { InlineConfirm } from '@/components/ui/InlineConfirm'

const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  apec: 'APEC',
  hellowork: 'HelloWork',
  france_travail: 'France Travail',
  email: 'Email',
}

interface Props {
  offer: Offer
  onAction: (id: string, action: 'postule' | 'ignore' | 'sauvegarde') => Promise<void>
}

export function OfferCard({ offer, onAction }: Props) {
  const [confirmIgnore, setConfirmIgnore] = useState(false)

  return (
    <div className="offer-card bg-white border border-zinc-200 rounded-xl p-4 hover:shadow-sm hover:border-zinc-300 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-zinc-900 font-semibold text-sm truncate">{offer.titre}</h3>
          <p className="text-zinc-400 text-xs mt-0.5">
            {offer.entreprise && <span className="font-medium text-zinc-600">{offer.entreprise}</span>}
            {offer.entreprise && offer.localisation && ' · '}
            {offer.localisation}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {offer.type_contrat && (
              <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded capitalize">{offer.type_contrat}</span>
            )}
            {(offer.salaire_min || offer.salaire_max) && (
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                {offer.salaire_min && `${offer.salaire_min.toLocaleString('fr-FR')}€`}
                {offer.salaire_min && offer.salaire_max && ' – '}
                {offer.salaire_max && `${offer.salaire_max.toLocaleString('fr-FR')}€`}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">
            {SOURCE_LABELS[offer.source ?? ''] ?? offer.source ?? 'Inconnu'}
          </span>
          {offer.lien && (
            <a
              href={offer.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 text-xs hover:text-indigo-500 transition-colors"
            >
              Voir →
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100">
        <button
          onClick={() => onAction(offer.id, 'postule')}
          className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
        >
          Postuler
        </button>
        <button
          onClick={() => onAction(offer.id, 'sauvegarde')}
          className="flex-1 border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 text-xs py-1.5 rounded-lg transition-colors"
        >
          Sauvegarder
        </button>
        <button
          onClick={() => setConfirmIgnore(true)}
          className="px-3 text-zinc-400 hover:text-red-500 text-xs py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          Ignorer
        </button>
      </div>

      <InlineConfirm
        visible={confirmIgnore}
        message="Ignorer cette offre ?"
        confirmLabel="Ignorer"
        onConfirm={() => { setConfirmIgnore(false); onAction(offer.id, 'ignore') }}
        onCancel={() => setConfirmIgnore(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Replace offers page filters with pill buttons**

In `app/offers/page.tsx`, replace the `<select>` elements and add pill button rendering. Replace the entire filter section (the `<div className="flex flex-wrap gap-3">` block) and the `selectClass` variable with:

```typescript
// Remove selectClass variable entirely

// Replace filter div:
<div className="space-y-3">
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Statut</p>
    <div className="flex flex-wrap gap-2">
      {STATUS_FILTER_OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => setFilterStatus(o.value as OfferStatus | '')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterStatus === o.value
              ? 'bg-zinc-900 text-white'
              : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Source</p>
    <div className="flex flex-wrap gap-2">
      {SOURCE_OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => setFilterSource(o.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterSource === o.value
              ? 'bg-indigo-500 text-white'
              : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
</div>
```

Also update the page header text and grid colors to zinc theme:
```typescript
// Replace h1 class:
className="text-2xl font-bold text-zinc-900 tracking-tight"

// Replace count p class:
className="text-zinc-500 text-sm mt-1"
```

Add GSAP stagger after `setLoading(false)` in `fetchOffers`. Add `useRef` to the offers grid:

```typescript
const gridRef = useRef<HTMLDivElement>(null)

// After setOffers(data) and setLoading(false):
requestAnimationFrame(() => {
  if (!gridRef.current) return
  const cards = gridRef.current.querySelectorAll('.offer-card')
  gsap.from(cards, { y: 12, opacity: 0, stagger: 0.05, duration: 0.3, ease: 'power2.out' })
})

// Add ref to grid div:
<div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Navigate to `/offers` — pill buttons instead of selects, InlineConfirm on Ignorer.

- [ ] **Step 4: Commit**

```bash
git add app/offers/page.tsx components/offers/OfferCard.tsx
git commit -m "feat: offers — pill filter buttons, zinc theme, inline confirm on ignore"
```

---

## Task 11: ApplicationsTable — Inline Confirm + Zinc Theme

**Files:**
- Modify: `components/applications/ApplicationsTable.tsx`

- [ ] **Step 1: Add InlineConfirm to delete action**

In `components/applications/ApplicationsTable.tsx`:

1. Add import at top:
```typescript
import { InlineConfirm } from '@/components/ui/InlineConfirm'
```

2. Add state:
```typescript
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
```

3. Replace the delete button:
```typescript
// Before:
<button onClick={() => { if (confirm(`Supprimer la candidature chez ${app.entreprise} ?`)) onDelete(app.id) }} className="text-muted hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-colors">Sup.</button>

// After:
<button
  onClick={() => setConfirmDeleteId(app.id)}
  className="text-zinc-400 hover:text-red-500 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
>
  Supprimer
</button>
```

4. After the `</tr>` closing tag for `expandedId` notes row, add (still inside the `filtered.map` callback, as a sibling fragment item):
```typescript
{confirmDeleteId === app.id && (
  <tr key={`${app.id}-confirm`}>
    <td colSpan={6} className="px-4 py-2">
      <InlineConfirm
        visible={true}
        message={`Supprimer la candidature chez ${app.entreprise} ?`}
        onConfirm={() => { onDelete(app.id); setConfirmDeleteId(null) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </td>
  </tr>
)}
```

5. Update table background and text colors to zinc theme:
```typescript
// bg-card → bg-white
// border-border → border-zinc-200
// text-foreground → text-zinc-900
// text-muted → text-zinc-500
// bg-background → bg-zinc-50
// hover:bg-background/50 → hover:bg-zinc-50
```

- [ ] **Step 2: Verify**

```bash
npm run dev
```

Navigate to `/applications` — clicking "Supprimer" shows inline red banner in table row.

- [ ] **Step 3: Commit**

```bash
git add components/applications/ApplicationsTable.tsx
git commit -m "feat: applications table — inline confirm delete, zinc theme"
```

---

## Task 12: Run All Tests

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass (TagInput × 6, AsyncButton × 4, InlineConfirm × 5 = 15 tests)

If any fail, read the error and fix the source file. Common issues:
- GSAP import in jsdom: mock it in jest.setup.ts:
  ```typescript
  jest.mock('gsap', () => ({
    gsap: { from: jest.fn(), fromTo: jest.fn(), to: jest.fn() },
  }))
  ```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors before committing.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: build succeeds. Fix any errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve any type/build errors after redesign"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Test all pages manually**

```bash
npm run dev
```

Checklist:
- [ ] `/` Dashboard — zinc bg, stat cards visible, white cards
- [ ] `/applications` — table zinc theme, delete = inline confirm (no browser dialog)
- [ ] `/offers` — pill filters work, OfferCard zinc, "Ignorer" = inline confirm
- [ ] `/search` — "Nouveau profil" = modal, tag pills work (type + Enter adds tag), qualifications suggestions clickable, "↻ Lancer" = spinner → success/error
- [ ] Nav hover — all items show zinc-100 bg, logout shows red hover
- [ ] Mobile (resize window < 1024px) — sidebar hidden, hamburger visible, tap opens drawer
- [ ] GSAP — cards animate on page load (fade+slide), modal scales in

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete light mode UI/UX redesign with GSAP animations"
```
