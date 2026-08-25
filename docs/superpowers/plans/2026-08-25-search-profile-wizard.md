# Search Profile Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-screen `ProfileModal` search-profile form with a 6-step wizard (`WizardModal`) that adds a domain field driving keyword/qualification suggestions, supports multiple cities each with its own radius, and blocks a keyword from being added to both the include and exclude lists.

**Architecture:** `WizardModal.tsx` owns all form state and step navigation; six small step components (`components/search/steps/*.tsx`) each render one screen and receive only the slice of state they need via props. A new `SearchProfile.domaine` (string) and `SearchProfile.localisations` (jsonb array of `{ville, rayon_km}`) replace the old single `localisation`/`rayon_km` columns — this is a DB migration plus a type change. The scraping backend (`app/api/jobs/fetch/route.ts`) keeps its existing per-keyword OR loop, just nested inside a new per-city loop. Domain-driven keyword suggestions live in a static lookup table (`domainSuggestions.ts`) — no LLM call.

**Tech Stack:** Next.js 16 App Router, React (client components), Supabase (Postgres + `jsonb`), Jest + Testing Library + `userEvent`, GSAP (modal enter/exit animation, unchanged from `ProfileModal`).

---

## Reference: current code being replaced

- `components/search/ProfileModal.tsx` — the file being deleted at the end of this plan. Read it before starting if you want to see the exact fields/behavior being preserved (contract-type toggle, duration select, exclusion presets, salary field) — Task 9 (`StepContrat`) and Task 7 (`StepMotsClesExclus`) port this logic verbatim into smaller files.
- `lib/supabase/types.ts:55-69` — current `SearchProfile` interface (has `localisation: string | null` and `rayon_km: number`, no `domaine`).
- `app/api/jobs/fetch/route.ts:72-97` — current per-profile scraping loop, single `location` variable, no city loop.
- None of the four scraper functions (`fetchJSearch`, `fetchAPEC`, `fetchHelloWork`, `fetchFranceTravail`) accept a radius parameter today — only `keywords` and `location` (a city name string). This plan does not change scraper signatures.

---

### Task 1: Database migration + type update

**Files:**
- Create: `supabase/migrations/004_search_profile_wizard.sql`
- Modify: `lib/supabase/types.ts:55-69`

- [ ] **Step 1: Write the migration file**

```sql
-- Add domain field and multi-city support to search_profiles
alter table search_profiles
  add column if not exists domaine text,
  add column if not exists localisations jsonb default '[]';

-- Migrate existing single-city data into the new jsonb array
update search_profiles
set localisations = jsonb_build_array(jsonb_build_object('ville', localisation, 'rayon_km', rayon_km))
where localisation is not null and (localisations is null or localisations = '[]');

alter table search_profiles
  drop column if exists localisation,
  drop column if exists rayon_km;
```

- [ ] **Step 2: Update `lib/supabase/types.ts`**

Replace lines 55-69 (the `SearchProfile` interface) with:

```ts
export interface SearchLocation {
  ville: string
  rayon_km: number
}

export interface SearchProfile {
  id: string
  user_id: string
  nom: string | null
  actif: boolean
  domaine: string | null
  type_contrat: string[] | null
  mots_cles: string[] | null
  mots_cles_exclus: string[] | null
  qualifications: string[] | null
  duree_contrat: 'peu_importe' | '1_semaine' | '2_semaines' | '3_semaines' | 'moins_1_mois' | '1_3_mois' | '3_6_mois' | '6_plus' | null
  localisations: SearchLocation[]
  salaire_min: number | null
  created_at: string
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: New errors in `components/search/ProfileModal.tsx`, `app/search/page.tsx`, `app/api/search-profiles/route.ts`, `app/api/search-profiles/[id]/route.ts`, `app/api/jobs/fetch/route.ts` (all reference `localisation`/`rayon_km`). These are expected — later tasks fix each one. Confirm no *other* files are broken.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_search_profile_wizard.sql lib/supabase/types.ts
git commit -m "feat(db): add domaine and multi-city localisations to search_profiles"
```

- [ ] **Step 5: Apply the migration**

This must be run manually against the Supabase project (no CLI credentials in this environment):
1. Open the Supabase project dashboard → SQL Editor
2. Paste the contents of `supabase/migrations/004_search_profile_wizard.sql`
3. Run it
4. Verify: `select domaine, localisations from search_profiles limit 5;` returns the new columns with existing rows' city migrated into `localisations`.

---

### Task 2: `domainSuggestions.ts` data module

**Files:**
- Create: `components/search/domainSuggestions.ts`
- Test: `__tests__/components/search/domainSuggestions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { DOMAIN_SUGGESTIONS, DOMAIN_OPTIONS, DOMAIN_LABELS } from '@/components/search/domainSuggestions'

describe('domainSuggestions', () => {
  it('has a suggestions entry for every predefined domain option except "autre"', () => {
    const predefinedKeys = DOMAIN_OPTIONS.map(o => o.value).filter(v => v !== 'autre')
    for (const key of predefinedKeys) {
      expect(DOMAIN_SUGGESTIONS[key]).toBeDefined()
      expect(DOMAIN_SUGGESTIONS[key].motsCles.length).toBeGreaterThan(0)
      expect(DOMAIN_SUGGESTIONS[key].exclusions.length).toBeGreaterThan(0)
      expect(DOMAIN_SUGGESTIONS[key].qualifications.length).toBeGreaterThan(0)
    }
  })

  it('includes an "autre" option with no suggestions entry', () => {
    expect(DOMAIN_OPTIONS.some(o => o.value === 'autre')).toBe(true)
    expect(DOMAIN_SUGGESTIONS['autre']).toBeUndefined()
  })

  it('DOMAIN_LABELS maps every option value to its label', () => {
    for (const { value, label } of DOMAIN_OPTIONS) {
      expect(DOMAIN_LABELS[value]).toBe(label)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/search/domainSuggestions.test.ts`
Expected: FAIL with "Cannot find module '@/components/search/domainSuggestions'"

- [ ] **Step 3: Write the implementation**

```ts
export interface DomainSuggestions {
  motsCles: string[]
  exclusions: string[]
  qualifications: string[]
}

export const DOMAIN_SUGGESTIONS: Record<string, DomainSuggestions> = {
  data_ia: {
    motsCles: ['data scientist', 'data analyst', 'machine learning', 'data engineer', 'MLOps', 'intelligence artificielle'],
    exclusions: ['stage', 'junior', "5 ans d'expérience", 'senior', 'thèse', 'doctorat'],
    qualifications: ['AWS', 'Azure', 'GCP', 'TensorFlow', 'PyTorch', 'SQL', 'Python', 'Bac+5'],
  },
  dev_logiciel: {
    motsCles: ['développeur', 'ingénieur logiciel', 'full stack', 'backend', 'frontend', 'software engineer'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience", 'architecte'],
    qualifications: ['JavaScript', 'TypeScript', 'Java', 'Python', 'React', 'Node.js', 'Bac+5'],
  },
  devops_cloud: {
    motsCles: ['devops', 'sre', 'cloud engineer', 'infrastructure', 'plateforme', 'ci/cd'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience"],
    qualifications: ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'Terraform', 'Bac+5'],
  },
  cybersecurite: {
    motsCles: ['sécurité informatique', 'analyste soc', 'pentester', 'cybersécurité', 'RSSI'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience"],
    qualifications: ['CEH', 'OSCP', 'ISO 27001', 'CISSP', 'Bac+5'],
  },
  product_design: {
    motsCles: ['product manager', 'product owner', 'UX designer', 'UI designer', 'chef de produit'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience"],
    qualifications: ['Figma', 'Agile', 'Scrum', 'Bac+5'],
  },
  reseaux_infra: {
    motsCles: ['administrateur réseau', 'ingénieur infrastructure', 'réseaux et télécoms', 'systèmes et réseaux'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience"],
    qualifications: ['CCNA', 'CCNP', 'Linux', 'Windows Server', 'Bac+2'],
  },
  support_it: {
    motsCles: ['support informatique', 'technicien helpdesk', 'assistance utilisateurs', 'technicien support'],
    exclusions: ['lead', "5 ans d'expérience", 'senior'],
    qualifications: ['ITIL', 'Bac+2'],
  },
}

export const DOMAIN_OPTIONS: { value: string; label: string }[] = [
  { value: 'data_ia', label: 'Data / IA' },
  { value: 'dev_logiciel', label: 'Développement logiciel' },
  { value: 'devops_cloud', label: 'DevOps / Cloud' },
  { value: 'cybersecurite', label: 'Cybersécurité' },
  { value: 'product_design', label: 'Product / Design' },
  { value: 'reseaux_infra', label: 'Réseaux / Infra' },
  { value: 'support_it', label: 'Support IT' },
  { value: 'autre', label: 'Autre' },
]

export const DOMAIN_LABELS: Record<string, string> = Object.fromEntries(
  DOMAIN_OPTIONS.map(o => [o.value, o.label])
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/search/domainSuggestions.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/search/domainSuggestions.ts __tests__/components/search/domainSuggestions.test.ts
git commit -m "feat(search): add domain-driven keyword suggestion data"
```

---

### Task 3: Shared wizard input style constant

**Files:**
- Create: `components/search/wizardStyles.ts`

- [ ] **Step 1: Write the file**

```ts
export const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10'
```

No test — this is a static string constant, identical to the one already used (and proven) in `ProfileModal.tsx:101`.

- [ ] **Step 2: Commit**

```bash
git add components/search/wizardStyles.ts
git commit -m "chore(search): extract shared wizard input style"
```

---

### Task 4: `StepIdentite` (nom + domaine)

**Files:**
- Create: `components/search/steps/StepIdentite.tsx`
- Test: `__tests__/components/search/steps/StepIdentite.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepIdentite } from '@/components/search/steps/StepIdentite'

describe('StepIdentite', () => {
  it('calls onChange with nom when typing in the name field', async () => {
    const onChange = jest.fn()
    render(<StepIdentite nom="" domaineKey="data_ia" domaineAutre="" onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText(/Data\/IA Lille/i), 'X')
    expect(onChange).toHaveBeenCalledWith({ nom: 'X' })
  })

  it('calls onChange with domaineKey when selecting a domain', async () => {
    const onChange = jest.fn()
    render(<StepIdentite nom="Test" domaineKey="data_ia" domaineAutre="" onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'dev_logiciel')
    expect(onChange).toHaveBeenCalledWith({ domaineKey: 'dev_logiciel' })
  })

  it('shows a free-text field only when domaineKey is "autre"', () => {
    const { rerender } = render(<StepIdentite nom="Test" domaineKey="data_ia" domaineAutre="" onChange={() => {}} />)
    expect(screen.queryByPlaceholderText(/Community management/i)).not.toBeInTheDocument()
    rerender(<StepIdentite nom="Test" domaineKey="autre" domaineAutre="" onChange={() => {}} />)
    expect(screen.getByPlaceholderText(/Community management/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepIdentite.test.tsx`
Expected: FAIL with "Cannot find module '@/components/search/steps/StepIdentite'"

- [ ] **Step 3: Write the implementation**

```tsx
'use client'

import { inputClass } from '../wizardStyles'
import { DOMAIN_OPTIONS } from '../domainSuggestions'

interface StepIdentiteProps {
  nom: string
  domaineKey: string
  domaineAutre: string
  onChange: (patch: Partial<{ nom: string; domaineKey: string; domaineAutre: string }>) => void
}

export function StepIdentite({ nom, domaineKey, domaineAutre, onChange }: StepIdentiteProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Nom du profil</label>
        <input
          value={nom}
          onChange={e => onChange({ nom: e.target.value })}
          placeholder="Ex: Data/IA Lille 2026"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Domaine</label>
        <select
          value={domaineKey}
          onChange={e => onChange({ domaineKey: e.target.value })}
          className={inputClass}
        >
          {DOMAIN_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {domaineKey === 'autre' && (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Précisez le domaine</label>
          <input
            value={domaineAutre}
            onChange={e => onChange({ domaineAutre: e.target.value })}
            placeholder="Ex: Community management"
            className={inputClass}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepIdentite.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/search/steps/StepIdentite.tsx __tests__/components/search/steps/StepIdentite.test.tsx
git commit -m "feat(search): add wizard identity step (nom + domaine)"
```

---

### Task 5: `StepVilles` (multi-city, per-city radius)

**Files:**
- Create: `components/search/steps/StepVilles.tsx`
- Test: `__tests__/components/search/steps/StepVilles.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepVilles } from '@/components/search/steps/StepVilles'

describe('StepVilles', () => {
  it('renders one row per location with ville and rayon values', () => {
    render(
      <StepVilles
        value={[{ ville: 'Lille', rayon_km: 30 }, { ville: 'Paris', rayon_km: 20 }]}
        onChange={() => {}}
      />
    )
    expect(screen.getByDisplayValue('Lille')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Paris')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
  })

  it('adds a new empty row when "+ Ajouter une ville" is clicked', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30 }]} onChange={onChange} />)
    await userEvent.click(screen.getByText('+ Ajouter une ville'))
    expect(onChange).toHaveBeenCalledWith([
      { ville: 'Lille', rayon_km: 30 },
      { ville: '', rayon_km: 30 },
    ])
  })

  it('removes a row when its ✕ button is clicked', async () => {
    const onChange = jest.fn()
    render(
      <StepVilles
        value={[{ ville: 'Lille', rayon_km: 30 }, { ville: 'Paris', rayon_km: 20 }]}
        onChange={onChange}
      />
    )
    await userEvent.click(screen.getByLabelText('Supprimer la ville Paris'))
    expect(onChange).toHaveBeenCalledWith([{ ville: 'Lille', rayon_km: 30 }])
  })

  it('updates the ville field of the right row on typing', async () => {
    const onChange = jest.fn()
    render(<StepVilles value={[{ ville: 'Lille', rayon_km: 30 }]} onChange={onChange} />)
    await userEvent.type(screen.getByDisplayValue('Lille'), 'e')
    expect(onChange).toHaveBeenCalledWith([{ ville: 'Lillee', rayon_km: 30 }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepVilles.test.tsx`
Expected: FAIL with "Cannot find module '@/components/search/steps/StepVilles'"

- [ ] **Step 3: Write the implementation**

```tsx
'use client'

import type { SearchLocation } from '@/lib/supabase/types'
import { inputClass } from '../wizardStyles'

interface StepVillesProps {
  value: SearchLocation[]
  onChange: (value: SearchLocation[]) => void
}

export function StepVilles({ value, onChange }: StepVillesProps) {
  const updateRow = (index: number, patch: Partial<SearchLocation>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onChange([...value, { ville: '', rayon_km: 30 }])
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium" style={{ color: 'var(--muted)' }}>Villes recherchées</label>
      {value.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted-light)' }}>Ville</label>
            <input
              value={row.ville}
              onChange={e => updateRow(index, { ville: e.target.value })}
              placeholder="Lille"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted-light)' }}>Rayon (km)</label>
            <input
              type="number" min="0" max="100"
              value={row.rayon_km}
              onChange={e => updateRow(index, { rayon_km: Number(e.target.value) })}
              className={`${inputClass} w-24`}
            />
          </div>
          <button
            type="button"
            onClick={() => removeRow(index)}
            aria-label={`Supprimer la ville ${row.ville || index + 1}`}
            className="text-xs px-2 py-2 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500"
            style={{ color: 'var(--muted)' }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
      >
        + Ajouter une ville
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepVilles.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/search/steps/StepVilles.tsx __tests__/components/search/steps/StepVilles.test.tsx
git commit -m "feat(search): add wizard multi-city step with per-city radius"
```

---

### Task 6: `StepMotsClesInclus` (include keywords, blocked by exclude list)

**Files:**
- Create: `components/search/steps/StepMotsClesInclus.tsx`
- Test: `__tests__/components/search/steps/StepMotsClesInclus.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepMotsClesInclus } from '@/components/search/steps/StepMotsClesInclus'

describe('StepMotsClesInclus', () => {
  it('adds a keyword via the TagInput', async () => {
    const onChange = jest.fn()
    render(<StepMotsClesInclus value={[]} onChange={onChange} domaineKey="data_ia" conflictsWith={[]} />)
    await userEvent.type(screen.getByRole('textbox'), 'data scientist{enter}')
    expect(onChange).toHaveBeenCalledWith(['data scientist'])
  })

  it('shows domain suggestions for the selected domaineKey', () => {
    render(<StepMotsClesInclus value={[]} onChange={() => {}} domaineKey="data_ia" conflictsWith={[]} />)
    expect(screen.getByText('data scientist')).toBeInTheDocument()
  })

  it('blocks adding a keyword already present in the exclude list', async () => {
    const onChange = jest.fn()
    render(
      <StepMotsClesInclus
        value={[]}
        onChange={onChange}
        domaineKey="data_ia"
        conflictsWith={['senior']}
      />
    )
    await userEvent.type(screen.getByRole('textbox'), 'senior{enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/déjà dans les mots-clés à exclure/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepMotsClesInclus.test.tsx`
Expected: FAIL with "Cannot find module '@/components/search/steps/StepMotsClesInclus'"

- [ ] **Step 3: Write the implementation**

```tsx
'use client'

import { useState } from 'react'
import { TagInput } from '@/components/ui/TagInput'
import { DOMAIN_SUGGESTIONS } from '../domainSuggestions'

interface StepMotsClesInclusProps {
  value: string[]
  onChange: (value: string[]) => void
  domaineKey: string
  conflictsWith: string[]
}

export function StepMotsClesInclus({ value, onChange, domaineKey, conflictsWith }: StepMotsClesInclusProps) {
  const [error, setError] = useState<string | null>(null)
  const suggestions = DOMAIN_SUGGESTIONS[domaineKey]?.motsCles ?? []

  const handleChange = (newTags: string[]) => {
    if (newTags.length > value.length) {
      const added = newTags[newTags.length - 1]
      if (conflictsWith.includes(added)) {
        setError(`"${added}" est déjà dans les mots-clés à exclure`)
        return
      }
    }
    setError(null)
    onChange(newTags)
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Mots-clés à inclure</label>
      <p className="text-xs mb-2" style={{ color: 'var(--muted-light)' }}>
        Pensez aux variantes de titre de poste, outils, technologies.
      </p>
      <TagInput
        value={value}
        onChange={handleChange}
        suggestions={suggestions}
        placeholder="Tapez + Entrée ou virgule..."
        tagColor="indigo"
      />
      {error && <p className="text-xs mt-1.5 text-red-500">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepMotsClesInclus.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/search/steps/StepMotsClesInclus.tsx __tests__/components/search/steps/StepMotsClesInclus.test.tsx
git commit -m "feat(search): add wizard include-keywords step with exclude-list guard"
```

---

### Task 7: `StepMotsClesExclus` (exclude keywords + presets, blocked by include list)

**Files:**
- Create: `components/search/steps/StepMotsClesExclus.tsx`
- Test: `__tests__/components/search/steps/StepMotsClesExclus.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepMotsClesExclus } from '@/components/search/steps/StepMotsClesExclus'

describe('StepMotsClesExclus', () => {
  it('adds a keyword via the TagInput', async () => {
    const onChange = jest.fn()
    render(<StepMotsClesExclus value={[]} onChange={onChange} domaineKey="data_ia" conflictsWith={[]} />)
    await userEvent.type(screen.getByRole('textbox'), 'senior{enter}')
    expect(onChange).toHaveBeenCalledWith(['senior'])
  })

  it('toggles a contract-type preset button', async () => {
    const onChange = jest.fn()
    render(<StepMotsClesExclus value={[]} onChange={onChange} domaineKey="data_ia" conflictsWith={[]} />)
    await userEvent.click(screen.getByText('+ CDI'))
    expect(onChange).toHaveBeenCalledWith(['cdi'])
  })

  it('blocks adding a keyword already present in the include list', async () => {
    const onChange = jest.fn()
    render(
      <StepMotsClesExclus
        value={[]}
        onChange={onChange}
        domaineKey="data_ia"
        conflictsWith={['data scientist']}
      />
    )
    await userEvent.type(screen.getByRole('textbox'), 'data scientist{enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/déjà dans les mots-clés à inclure/i)).toBeInTheDocument()
  })

  it('blocks a preset click that conflicts with the include list', async () => {
    const onChange = jest.fn()
    render(
      <StepMotsClesExclus
        value={[]}
        onChange={onChange}
        domaineKey="data_ia"
        conflictsWith={['cdi']}
      />
    )
    await userEvent.click(screen.getByText('+ CDI'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/déjà dans les mots-clés à inclure/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepMotsClesExclus.test.tsx`
Expected: FAIL with "Cannot find module '@/components/search/steps/StepMotsClesExclus'"

- [ ] **Step 3: Write the implementation**

```tsx
'use client'

import { useState } from 'react'
import { TagInput } from '@/components/ui/TagInput'
import { DOMAIN_SUGGESTIONS } from '../domainSuggestions'

const EXCLUSION_PRESETS = [
  { label: 'CDI', value: 'cdi' },
  { label: 'CDD', value: 'cdd' },
  { label: 'Alternance', value: 'alternance' },
  { label: 'Stage', value: 'stage' },
  { label: 'Freelance', value: 'freelance' },
  { label: 'Temps plein', value: 'temps plein' },
  { label: 'Temps partiel', value: 'temps partiel' },
]

interface StepMotsClesExclusProps {
  value: string[]
  onChange: (value: string[]) => void
  domaineKey: string
  conflictsWith: string[]
}

export function StepMotsClesExclus({ value, onChange, domaineKey, conflictsWith }: StepMotsClesExclusProps) {
  const [error, setError] = useState<string | null>(null)
  const suggestions = DOMAIN_SUGGESTIONS[domaineKey]?.exclusions ?? []

  const applyChange = (newTags: string[], added?: string) => {
    if (added && conflictsWith.includes(added)) {
      setError(`"${added}" est déjà dans les mots-clés à inclure`)
      return
    }
    setError(null)
    onChange(newTags)
  }

  const handleTagInputChange = (newTags: string[]) => {
    if (newTags.length > value.length) {
      applyChange(newTags, newTags[newTags.length - 1])
    } else {
      applyChange(newTags)
    }
  }

  const togglePreset = (presetValue: string) => {
    const active = value.includes(presetValue)
    if (active) {
      applyChange(value.filter(k => k !== presetValue))
    } else {
      applyChange([...value, presetValue], presetValue)
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
        Mots-clés à exclure
        <span className="ml-1.5 font-normal" style={{ color: 'var(--muted-light)' }}>(offres contenant ces mots seront ignorées)</span>
      </label>
      <TagInput
        value={value}
        onChange={handleTagInputChange}
        suggestions={suggestions}
        placeholder="Ex: cadre, senior, 5 ans d'expérience..."
        tagColor="blue"
      />
      {error && <p className="text-xs mt-1.5 text-red-500">{error}</p>}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-xs" style={{ color: 'var(--muted-light)' }}>Ajouter :</span>
        {EXCLUSION_PRESETS.map(({ label, value: presetValue }) => {
          const active = value.includes(presetValue)
          return (
            <button
              key={presetValue}
              type="button"
              onClick={() => togglePreset(presetValue)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${active ? 'ring-1 ring-offset-1' : ''}`}
              style={
                active
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff', outlineColor: 'var(--accent)' }
                  : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }
              }
            >
              {active ? '✕ ' : '+ '}{label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepMotsClesExclus.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/search/steps/StepMotsClesExclus.tsx __tests__/components/search/steps/StepMotsClesExclus.test.tsx
git commit -m "feat(search): add wizard exclude-keywords step with include-list guard"
```

---

### Task 8: `StepQualifications`

**Files:**
- Create: `components/search/steps/StepQualifications.tsx`
- Test: `__tests__/components/search/steps/StepQualifications.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepQualifications } from '@/components/search/steps/StepQualifications'

describe('StepQualifications', () => {
  it('adds a qualification via the TagInput', async () => {
    const onChange = jest.fn()
    render(<StepQualifications value={[]} onChange={onChange} domaineKey="data_ia" />)
    await userEvent.type(screen.getByRole('textbox'), 'AWS{enter}')
    expect(onChange).toHaveBeenCalledWith(['AWS'])
  })

  it('shows domain suggestions for the selected domaineKey', () => {
    render(<StepQualifications value={[]} onChange={() => {}} domaineKey="data_ia" />)
    expect(screen.getByText('TensorFlow')).toBeInTheDocument()
  })

  it('shows no suggestions for a domain with no entry', () => {
    render(<StepQualifications value={[]} onChange={() => {}} domaineKey="autre" />)
    expect(screen.queryByText(/Suggestions/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepQualifications.test.tsx`
Expected: FAIL with "Cannot find module '@/components/search/steps/StepQualifications'"

- [ ] **Step 3: Write the implementation**

```tsx
'use client'

import { TagInput } from '@/components/ui/TagInput'
import { DOMAIN_SUGGESTIONS } from '../domainSuggestions'

interface StepQualificationsProps {
  value: string[]
  onChange: (value: string[]) => void
  domaineKey: string
}

export function StepQualifications({ value, onChange, domaineKey }: StepQualificationsProps) {
  const suggestions = DOMAIN_SUGGESTIONS[domaineKey]?.qualifications ?? []
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Qualifications</label>
      <TagInput
        value={value}
        onChange={onChange}
        suggestions={suggestions}
        placeholder="Ex: AWS, TensorFlow, Bac+5..."
        tagColor="blue"
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepQualifications.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/search/steps/StepQualifications.tsx __tests__/components/search/steps/StepQualifications.test.tsx
git commit -m "feat(search): add wizard qualifications step"
```

---

### Task 9: `StepContrat`

**Files:**
- Create: `components/search/steps/StepContrat.tsx`
- Test: `__tests__/components/search/steps/StepContrat.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepContrat } from '@/components/search/steps/StepContrat'

describe('StepContrat', () => {
  it('toggles a contract type button', async () => {
    const onChange = jest.fn()
    render(
      <StepContrat typeContrat={[]} dureeContrat="peu_importe" salaireMin="" onChange={onChange} />
    )
    await userEvent.click(screen.getByText('cdi'))
    expect(onChange).toHaveBeenCalledWith({ type_contrat: ['cdi'] })
  })

  it('un-toggles an active contract type button', async () => {
    const onChange = jest.fn()
    render(
      <StepContrat typeContrat={['cdi']} dureeContrat="peu_importe" salaireMin="" onChange={onChange} />
    )
    await userEvent.click(screen.getByText('cdi'))
    expect(onChange).toHaveBeenCalledWith({ type_contrat: [] })
  })

  it('changes duree_contrat on select', async () => {
    const onChange = jest.fn()
    render(
      <StepContrat typeContrat={[]} dureeContrat="peu_importe" salaireMin="" onChange={onChange} />
    )
    await userEvent.selectOptions(screen.getByRole('combobox'), '1_semaine')
    expect(onChange).toHaveBeenCalledWith({ duree_contrat: '1_semaine' })
  })

  it('changes salaire_min on typing a number', async () => {
    const onChange = jest.fn()
    render(
      <StepContrat typeContrat={[]} dureeContrat="peu_importe" salaireMin="" onChange={onChange} />
    )
    await userEvent.type(screen.getByPlaceholderText('1500'), '9')
    expect(onChange).toHaveBeenCalledWith({ salaire_min: 9 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepContrat.test.tsx`
Expected: FAIL with "Cannot find module '@/components/search/steps/StepContrat'"

- [ ] **Step 3: Write the implementation**

```tsx
'use client'

import type { SearchProfile } from '@/lib/supabase/types'
import { inputClass } from '../wizardStyles'

const CONTRACT_TYPES = ['interim', 'stage', 'cdi', 'cdd', 'alternance']
const DUREE_GROUPS = [
  {
    label: 'Court terme',
    options: [
      { value: '1_semaine', label: '1 semaine' },
      { value: '2_semaines', label: '2 semaines' },
      { value: '3_semaines', label: '3 semaines' },
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
    options: [{ value: '6_plus', label: '6 mois et plus' }],
  },
]

interface StepContratProps {
  typeContrat: string[]
  dureeContrat: SearchProfile['duree_contrat']
  salaireMin: number | ''
  onChange: (patch: Partial<{ type_contrat: string[]; duree_contrat: SearchProfile['duree_contrat']; salaire_min: number | '' }>) => void
}

export function StepContrat({ typeContrat, dureeContrat, salaireMin, onChange }: StepContratProps) {
  const toggleContract = (ct: string) => {
    onChange({
      type_contrat: typeContrat.includes(ct)
        ? typeContrat.filter(c => c !== ct)
        : [...typeContrat, ct],
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Types de contrat</label>
        <div className="flex flex-wrap gap-2">
          {CONTRACT_TYPES.map(ct => (
            <button
              key={ct}
              type="button"
              onClick={() => toggleContract(ct)}
              className="px-3 py-1 rounded-full text-xs border transition-colors capitalize"
              style={
                typeContrat.includes(ct)
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                  : { borderColor: 'var(--border)', color: 'var(--muted)' }
              }
            >
              {ct}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Durée de contrat</label>
          <select
            value={dureeContrat ?? 'peu_importe'}
            onChange={e => onChange({ duree_contrat: e.target.value as SearchProfile['duree_contrat'] })}
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
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Salaire min (€/mois)</label>
          <input
            type="number"
            value={salaireMin}
            onChange={e => onChange({ salaire_min: e.target.value === '' ? '' : Number(e.target.value) })}
            placeholder="1500"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/search/steps/StepContrat.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/search/steps/StepContrat.tsx __tests__/components/search/steps/StepContrat.test.tsx
git commit -m "feat(search): add wizard contract-terms step"
```

---

### Task 10: `WizardModal` orchestrator

**Files:**
- Create: `components/search/WizardModal.tsx`
- Test: `__tests__/components/search/WizardModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardModal } from '@/components/search/WizardModal'
import type { SearchProfile } from '@/lib/supabase/types'

describe('WizardModal', () => {
  it('disables "Suivant" on step 1 until a name is entered', async () => {
    render(<WizardModal onSave={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByText('Suivant')).toBeDisabled()
    await userEvent.type(screen.getByPlaceholderText(/Data\/IA Lille/i), 'Mon profil')
    expect(screen.getByText('Suivant')).toBeEnabled()
  })

  it('advances to step 2 (villes) after clicking "Suivant"', async () => {
    render(<WizardModal onSave={jest.fn()} onClose={jest.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(/Data\/IA Lille/i), 'Mon profil')
    await userEvent.click(screen.getByText('Suivant'))
    expect(screen.getByText('Villes recherchées')).toBeInTheDocument()
  })

  it('does not allow jumping to an unvisited step via the progress bar', async () => {
    render(<WizardModal onSave={jest.fn()} onClose={jest.fn()} />)
    const step3Dot = screen.getByLabelText('Étape 3 : Mots-clés inclus')
    expect(step3Dot).toBeDisabled()
  })

  it('pre-fills fields and marks all steps visited when editing an existing profile', async () => {
    const profile: SearchProfile = {
      id: 'p1',
      user_id: 'u1',
      nom: 'Existant',
      actif: true,
      domaine: 'data_ia',
      type_contrat: [],
      mots_cles: ['data scientist'],
      mots_cles_exclus: [],
      qualifications: [],
      duree_contrat: 'peu_importe',
      localisations: [{ ville: 'Lille', rayon_km: 30 }],
      salaire_min: null,
      created_at: '2026-01-01T00:00:00Z',
    }
    render(<WizardModal profile={profile} onSave={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByDisplayValue('Existant')).toBeInTheDocument()
    const step6Dot = screen.getByLabelText('Étape 6 : Contrat')
    expect(step6Dot).toBeEnabled()
  })

  it('calls onSave with the resolved domaine and filtered localisations on the last step', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    const profile: SearchProfile = {
      id: 'p1',
      user_id: 'u1',
      nom: 'Existant',
      actif: true,
      domaine: 'data_ia',
      type_contrat: [],
      mots_cles: [],
      mots_cles_exclus: [],
      qualifications: [],
      duree_contrat: 'peu_importe',
      localisations: [{ ville: 'Lille', rayon_km: 30 }],
      salaire_min: null,
      created_at: '2026-01-01T00:00:00Z',
    }
    render(<WizardModal profile={profile} onSave={onSave} onClose={jest.fn()} />)
    await userEvent.click(screen.getByLabelText('Étape 6 : Contrat'))
    await userEvent.click(screen.getByText('Enregistrer'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Existant',
        domaine: 'data_ia',
        localisations: [{ ville: 'Lille', rayon_km: 30 }],
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/components/search/WizardModal.test.tsx`
Expected: FAIL with "Cannot find module '@/components/search/WizardModal'"

- [ ] **Step 3: Write the implementation**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { SearchProfile, SearchLocation } from '@/lib/supabase/types'
import { AsyncButton } from '@/components/ui/AsyncButton'
import { DOMAIN_SUGGESTIONS } from './domainSuggestions'
import { StepIdentite } from './steps/StepIdentite'
import { StepVilles } from './steps/StepVilles'
import { StepMotsClesInclus } from './steps/StepMotsClesInclus'
import { StepMotsClesExclus } from './steps/StepMotsClesExclus'
import { StepQualifications } from './steps/StepQualifications'
import { StepContrat } from './steps/StepContrat'

const STEP_LABELS = ['Identité', 'Villes', 'Mots-clés inclus', 'Mots-clés exclus', 'Qualifications', 'Contrat']

function resolveDomaine(domaineKey: string, domaineAutre: string): string | null {
  if (domaineKey === 'autre') return domaineAutre.trim() || null
  return domaineKey
}

function initDomain(domaine: string | null | undefined): { domaineKey: string; domaineAutre: string } {
  if (domaine && domaine in DOMAIN_SUGGESTIONS) return { domaineKey: domaine, domaineAutre: '' }
  return { domaineKey: 'autre', domaineAutre: domaine ?? '' }
}

interface WizardModalProps {
  profile?: SearchProfile | null
  onSave: (data: Partial<SearchProfile>) => Promise<void>
  onClose: () => void
}

export function WizardModal({ profile, onSave, onClose }: WizardModalProps) {
  const { domaineKey: initialDomaineKey, domaineAutre: initialDomaineAutre } = initDomain(profile?.domaine)

  const [form, setForm] = useState({
    nom: profile?.nom ?? '',
    domaineKey: initialDomaineKey,
    domaineAutre: initialDomaineAutre,
    localisations: profile?.localisations?.length ? profile.localisations : [{ ville: 'Lille', rayon_km: 30 } as SearchLocation],
    mots_cles: profile?.mots_cles ?? ['emploi'],
    mots_cles_exclus: profile?.mots_cles_exclus ?? [] as string[],
    qualifications: profile?.qualifications ?? [] as string[],
    duree_contrat: profile?.duree_contrat ?? 'peu_importe' as SearchProfile['duree_contrat'],
    type_contrat: profile?.type_contrat ?? [] as string[],
    salaire_min: profile?.salaire_min ?? ('' as number | ''),
  })

  const [step, setStep] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(
    () => new Set(profile ? [0, 1, 2, 3, 4, 5] : [0])
  )

  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    gsap.fromTo(cardRef.current, { opacity: 0, scale: 0.93, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'power2.out' })
  }, [])

  const handleClose = () => {
    gsap.to(cardRef.current, { opacity: 0, scale: 0.95, y: 8, duration: 0.18, ease: 'power2.in', onComplete: onClose })
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.18 })
  }

  const patch = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }))

  const isStepValid = (s: number): boolean => {
    if (s === 0) {
      if (!form.nom.trim()) return false
      if (form.domaineKey === 'autre' && !form.domaineAutre.trim()) return false
      return true
    }
    if (s === 1) {
      return form.localisations.some(l => l.ville.trim().length > 0)
    }
    return true
  }

  const goNext = () => {
    if (!isStepValid(step)) return
    const next = step + 1
    setStep(next)
    setVisited(v => new Set(v).add(next))
  }

  const goTo = (target: number) => {
    if (!visited.has(target)) return
    setStep(target)
  }

  const handleSave = async () => {
    await onSave({
      nom: form.nom,
      domaine: resolveDomaine(form.domaineKey, form.domaineAutre),
      localisations: form.localisations.filter(l => l.ville.trim().length > 0),
      mots_cles: form.mots_cles,
      mots_cles_exclus: form.mots_cles_exclus,
      qualifications: form.qualifications,
      duree_contrat: form.duree_contrat,
      type_contrat: form.type_contrat,
      salaire_min: form.salaire_min !== '' ? Number(form.salaire_min) : null,
    })
    handleClose()
  }

  const isLastStep = step === STEP_LABELS.length - 1

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={e => { if (e.target === overlayRef.current) handleClose() }}
    >
      <div
        ref={cardRef}
        className="w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            {profile ? 'Modifier le profil' : 'Nouveau profil'}
          </h2>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-zinc-100"
            style={{ color: 'var(--muted)' }}
            aria-label="Fermer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-6 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => goTo(i)}
              disabled={!visited.has(i)}
              aria-label={`Étape ${i + 1} : ${label}`}
              aria-current={i === step ? 'step' : undefined}
              className="flex-1 h-1.5 rounded-full transition-colors disabled:cursor-not-allowed"
              style={{ background: i === step ? 'var(--accent)' : visited.has(i) ? 'var(--accent-dim)' : 'var(--border)' }}
            />
          ))}
        </div>

        <div className="px-4 sm:px-6 py-5 max-h-[70vh] overflow-y-auto">
          <p className="text-xs font-medium mb-4" style={{ color: 'var(--muted-light)' }}>
            Étape {step + 1}/{STEP_LABELS.length} — {STEP_LABELS[step]}
          </p>
          {step === 0 && (
            <StepIdentite
              nom={form.nom}
              domaineKey={form.domaineKey}
              domaineAutre={form.domaineAutre}
              onChange={patch}
            />
          )}
          {step === 1 && (
            <StepVilles
              value={form.localisations}
              onChange={v => patch({ localisations: v })}
            />
          )}
          {step === 2 && (
            <StepMotsClesInclus
              value={form.mots_cles}
              onChange={v => patch({ mots_cles: v })}
              domaineKey={form.domaineKey}
              conflictsWith={form.mots_cles_exclus}
            />
          )}
          {step === 3 && (
            <StepMotsClesExclus
              value={form.mots_cles_exclus}
              onChange={v => patch({ mots_cles_exclus: v })}
              domaineKey={form.domaineKey}
              conflictsWith={form.mots_cles}
            />
          )}
          {step === 4 && (
            <StepQualifications
              value={form.qualifications}
              onChange={v => patch({ qualifications: v })}
              domaineKey={form.domaineKey}
            />
          )}
          {step === 5 && (
            <StepContrat
              typeContrat={form.type_contrat}
              dureeContrat={form.duree_contrat}
              salaireMin={form.salaire_min}
              onChange={patch}
            />
          )}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={step === 0 ? handleClose : () => setStep(step - 1)}
            className="flex-1 border rounded-lg py-2 text-sm transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            {step === 0 ? 'Annuler' : 'Précédent'}
          </button>
          {isLastStep ? (
            <AsyncButton
              onClick={handleSave}
              loadingLabel="Enregistrement..."
              successLabel="✓ Enregistré"
              className="flex-1 py-2"
            >
              Enregistrer
            </AsyncButton>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!isStepValid(step)}
              className="btn-accent text-white text-sm font-medium flex-1 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/components/search/WizardModal.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add components/search/WizardModal.tsx __tests__/components/search/WizardModal.test.tsx
git commit -m "feat(search): add WizardModal orchestrator for the step-by-step profile form"
```

---

### Task 11: Wire `WizardModal` into `app/search/page.tsx`, delete `ProfileModal`

**Files:**
- Modify: `app/search/page.tsx`
- Delete: `components/search/ProfileModal.tsx`

- [ ] **Step 1: Update imports and modal usage in `app/search/page.tsx`**

Replace line 5:
```ts
import { ProfileModal } from '@/components/search/ProfileModal'
```
with:
```ts
import { WizardModal } from '@/components/search/WizardModal'
import { DOMAIN_LABELS } from '@/components/search/domainSuggestions'
```

Replace the two `<ProfileModal ... />` usages (lines 194-206) with `<WizardModal ... />`, same props:

```tsx
{showModal && (
  <WizardModal
    onSave={handleCreate}
    onClose={() => setShowModal(false)}
  />
)}
{editProfile && (
  <WizardModal
    profile={editProfile}
    onSave={(data) => handleUpdate(editProfile.id, data)}
    onClose={() => setEditProfile(null)}
  />
)}
```

- [ ] **Step 2: Update the profile card display (lines 113-136)**

Replace:
```tsx
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
```

with:

```tsx
<div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 flex-wrap">
    <h3 className="font-medium" style={{ color: 'var(--foreground)' }}>
      {profile.nom || 'Profil sans nom'}
    </h3>
    {profile.domaine && (
      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
        {DOMAIN_LABELS[profile.domaine] ?? profile.domaine}
      </span>
    )}
    {profile.actif && (
      <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">
        Actif
      </span>
    )}
  </div>
  <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
    {(profile.localisations ?? []).map(l => `${l.ville} (${l.rayon_km}km)`).join(', ')}
  </p>
  {(profile.mots_cles ?? []).length > 0 && (
```

- [ ] **Step 3: Delete the old modal**

```bash
rm "components/search/ProfileModal.tsx"
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `app/search/page.tsx` or `ProfileModal`. Errors may remain in `app/api/search-profiles/route.ts`, `app/api/search-profiles/[id]/route.ts`, `app/api/jobs/fetch/route.ts` — fixed in Tasks 12-13.

- [ ] **Step 5: Commit**

```bash
git add app/search/page.tsx
git rm components/search/ProfileModal.tsx
git commit -m "feat(search): replace ProfileModal with WizardModal in search page"
```

---

### Task 12: Update `search-profiles` API routes for `domaine`/`localisations`

**Files:**
- Modify: `app/api/search-profiles/route.ts:24-36`
- Modify: `app/api/search-profiles/[id]/route.ts:12-24`

- [ ] **Step 1: Update `POST` in `app/api/search-profiles/route.ts`**

Replace lines 24-36:
```ts
  const body = await req.json()
  const allowed = {
    nom:             body.nom ?? null,
    actif:           body.actif ?? false,
    type_contrat:    body.type_contrat ?? [],
    mots_cles:       body.mots_cles ?? [],
    mots_cles_exclus: body.mots_cles_exclus ?? [],
    qualifications:  body.qualifications ?? [],
    duree_contrat:   body.duree_contrat ?? 'peu_importe',
    localisation:    body.localisation ?? 'Lille',
    rayon_km:        Number(body.rayon_km ?? 30),
    salaire_min:     body.salaire_min ?? null,
  }
```
with:
```ts
  const body = await req.json()
  const allowed = {
    nom:              body.nom ?? null,
    actif:            body.actif ?? false,
    domaine:          body.domaine ?? null,
    type_contrat:     body.type_contrat ?? [],
    mots_cles:        body.mots_cles ?? [],
    mots_cles_exclus: body.mots_cles_exclus ?? [],
    qualifications:   body.qualifications ?? [],
    duree_contrat:    body.duree_contrat ?? 'peu_importe',
    localisations:    body.localisations ?? [{ ville: 'Lille', rayon_km: 30 }],
    salaire_min:      body.salaire_min ?? null,
  }
```

- [ ] **Step 2: Update `PATCH` in `app/api/search-profiles/[id]/route.ts`**

Replace lines 12-24:
```ts
  const rawBody = await req.json()
  const body: Record<string, unknown> = {
    ...(rawBody.nom              !== undefined && { nom: rawBody.nom }),
    ...(rawBody.actif            !== undefined && { actif: rawBody.actif }),
    ...(rawBody.type_contrat     !== undefined && { type_contrat: rawBody.type_contrat }),
    ...(rawBody.mots_cles        !== undefined && { mots_cles: rawBody.mots_cles }),
    ...(rawBody.mots_cles_exclus !== undefined && { mots_cles_exclus: rawBody.mots_cles_exclus }),
    ...(rawBody.qualifications   !== undefined && { qualifications: rawBody.qualifications }),
    ...(rawBody.duree_contrat    !== undefined && { duree_contrat: rawBody.duree_contrat }),
    ...(rawBody.localisation     !== undefined && { localisation: rawBody.localisation }),
    ...(rawBody.rayon_km         !== undefined && { rayon_km: Number(rawBody.rayon_km) }),
    ...(rawBody.salaire_min      !== undefined && { salaire_min: rawBody.salaire_min }),
  }
```
with:
```ts
  const rawBody = await req.json()
  const body: Record<string, unknown> = {
    ...(rawBody.nom              !== undefined && { nom: rawBody.nom }),
    ...(rawBody.actif            !== undefined && { actif: rawBody.actif }),
    ...(rawBody.domaine          !== undefined && { domaine: rawBody.domaine }),
    ...(rawBody.type_contrat     !== undefined && { type_contrat: rawBody.type_contrat }),
    ...(rawBody.mots_cles        !== undefined && { mots_cles: rawBody.mots_cles }),
    ...(rawBody.mots_cles_exclus !== undefined && { mots_cles_exclus: rawBody.mots_cles_exclus }),
    ...(rawBody.qualifications   !== undefined && { qualifications: rawBody.qualifications }),
    ...(rawBody.duree_contrat    !== undefined && { duree_contrat: rawBody.duree_contrat }),
    ...(rawBody.localisations    !== undefined && { localisations: rawBody.localisations }),
    ...(rawBody.salaire_min      !== undefined && { salaire_min: rawBody.salaire_min }),
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors in either file. Only `app/api/jobs/fetch/route.ts` should still error (fixed in Task 13).

- [ ] **Step 4: Commit**

```bash
git add app/api/search-profiles/route.ts "app/api/search-profiles/[id]/route.ts"
git commit -m "feat(api): accept domaine and localisations on search-profiles create/update"
```

---

### Task 13: Multi-city scraping loop in `app/api/jobs/fetch/route.ts`

**Files:**
- Modify: `app/api/jobs/fetch/route.ts:72-97`
- Test: `__tests__/api/jobs-fetch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockProfile = {
  id: 'profile-1',
  user_id: 'user-1',
  nom: 'Data/IA',
  actif: true,
  domaine: 'data_ia',
  type_contrat: [] as string[],
  mots_cles: ['data scientist', 'data engineer'],
  mots_cles_exclus: [] as string[],
  qualifications: [] as string[],
  duree_contrat: 'peu_importe',
  localisations: [
    { ville: 'Lille', rayon_km: 30 },
    { ville: 'Paris', rayon_km: 20 },
  ],
  salaire_min: null,
  created_at: '2026-08-01T00:00:00Z',
}

const rateLimitChainOnce = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}

const profilesChainOnce = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  then: (resolve: (v: { data: typeof mockProfile[]; error: null }) => void) =>
    resolve({ data: [mockProfile], error: null }),
}

const mockSupabase = {
  auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  from: jest.fn()
    .mockReturnValueOnce(rateLimitChainOnce)
    .mockReturnValueOnce(profilesChainOnce),
}

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabase: jest.fn().mockResolvedValue(mockSupabase),
}))

jest.mock('@/lib/scrapers/jsearch', () => ({ fetchJSearch: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/apec', () => ({ fetchAPEC: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/hellowork', () => ({ fetchHelloWork: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/scrapers/france-travail', () => ({ fetchFranceTravail: jest.fn().mockResolvedValue([]) }))

import { POST } from '@/app/api/jobs/fetch/route'
import { fetchJSearch } from '@/lib/scrapers/jsearch'
import { fetchAPEC } from '@/lib/scrapers/apec'
import { fetchHelloWork } from '@/lib/scrapers/hellowork'
import { fetchFranceTravail } from '@/lib/scrapers/france-travail'

describe('POST /api/jobs/fetch — multi-city loop', () => {
  beforeEach(() => {
    mockSupabase.from
      .mockReset()
      .mockReturnValueOnce(rateLimitChainOnce)
      .mockReturnValueOnce(profilesChainOnce)
  })

  it('calls each scraper once per city × keyword combination', async () => {
    const req = new NextRequest('http://localhost/api/jobs/fetch', { method: 'POST' })
    await POST(req)

    expect(fetchJSearch).toHaveBeenCalledTimes(4)
    expect(fetchAPEC).toHaveBeenCalledTimes(4)
    expect(fetchHelloWork).toHaveBeenCalledTimes(4)
    expect(fetchFranceTravail).toHaveBeenCalledTimes(4)

    expect(fetchJSearch).toHaveBeenNthCalledWith(1, 'data scientist', 'Lille')
    expect(fetchJSearch).toHaveBeenNthCalledWith(2, 'data engineer', 'Lille')
    expect(fetchJSearch).toHaveBeenNthCalledWith(3, 'data scientist', 'Paris')
    expect(fetchJSearch).toHaveBeenNthCalledWith(4, 'data engineer', 'Paris')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage __tests__/api/jobs-fetch.test.ts`
Expected: FAIL — `fetchJSearch` called once per keyword only (2 times, not 4), since the route doesn't loop over cities yet.

- [ ] **Step 3: Update the scraping loop in `app/api/jobs/fetch/route.ts`**

Replace lines 72-97:
```ts
  for (const profile of profiles as SearchProfile[]) {
    const keywordsList = profile.mots_cles ?? ['emploi']
    const exclusions = (profile.mots_cles_exclus ?? []).map(k => k.toLowerCase())
    const location = profile.localisation ?? 'Lille'
    const typeContrats = profile.type_contrat ?? []

    // Detect work-time preference from exclusions → passed to FT API as tempsPlein filter
    const excludesTempsPlein = exclusions.some(e => e.includes('temps plein'))
    const excludesTempsPartiel = exclusions.some(e => e.includes('temps partiel'))
    const tempsPleinFilter: boolean | undefined =
      excludesTempsPlein ? false : excludesTempsPartiel ? true : undefined

    console.log('[jobs/fetch] Fetching', { keywords: keywordsList, location, typeContrats, tempsPleinFilter })

    // Wrap each scraper in a 7s timeout to prevent slow sources from blocking
    const withTimeout = <T>(p: Promise<T>, ms = 7000): Promise<T> =>
      Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

    // All sources: one call per keyword (OR behavior)
    // Qualifications are profile metadata only — not appended to queries
    const allPromises = keywordsList.flatMap(kw => [
      withTimeout(fetchJSearch(kw, location), 15000),
      withTimeout(fetchAPEC(kw, location), 7000),
      withTimeout(fetchHelloWork(kw, location, typeContrats), 7000),
      withTimeout(fetchFranceTravail(kw, location, typeContrats, tempsPleinFilter), 7000),
    ])
```
with:
```ts
  for (const profile of profiles as SearchProfile[]) {
    const keywordsList = profile.mots_cles ?? ['emploi']
    const exclusions = (profile.mots_cles_exclus ?? []).map(k => k.toLowerCase())
    const locations = profile.localisations?.length ? profile.localisations : [{ ville: 'Lille', rayon_km: 30 }]
    const typeContrats = profile.type_contrat ?? []

    // Detect work-time preference from exclusions → passed to FT API as tempsPlein filter
    const excludesTempsPlein = exclusions.some(e => e.includes('temps plein'))
    const excludesTempsPartiel = exclusions.some(e => e.includes('temps partiel'))
    const tempsPleinFilter: boolean | undefined =
      excludesTempsPlein ? false : excludesTempsPartiel ? true : undefined

    console.log('[jobs/fetch] Fetching', { keywords: keywordsList, locations, typeContrats, tempsPleinFilter })

    // Wrap each scraper in a 7s timeout to prevent slow sources from blocking
    const withTimeout = <T>(p: Promise<T>, ms = 7000): Promise<T> =>
      Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

    // All sources: one call per city × keyword (OR behavior on both axes)
    // Qualifications are profile metadata only — not appended to queries
    const allPromises = locations.flatMap(loc => keywordsList.flatMap(kw => [
      withTimeout(fetchJSearch(kw, loc.ville), 15000),
      withTimeout(fetchAPEC(kw, loc.ville), 7000),
      withTimeout(fetchHelloWork(kw, loc.ville, typeContrats), 7000),
      withTimeout(fetchFranceTravail(kw, loc.ville, typeContrats, tempsPleinFilter), 7000),
    ]))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage __tests__/api/jobs-fetch.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Type-check and run the full test suite**

Run: `npx tsc --noEmit`
Expected: No errors anywhere.

Run: `npx jest --no-coverage`
Expected: All test suites pass, including the pre-existing dashboard test (which may reference `SearchProfile` mock shape — if it fails on missing `domaine`/`localisations` fields, update its mock profile fixture to match the new `SearchProfile` shape used in Task 1).

- [ ] **Step 6: Commit**

```bash
git add app/api/jobs/fetch/route.ts __tests__/api/jobs-fetch.test.ts
git commit -m "feat(api): loop scraping over each profile city, not just one location"
```

---

## Self-review notes (already applied above)

- **Spec coverage:** domain field + suggestions (Tasks 2, 4, 6-8), multi-city with per-city radius (Tasks 1, 5, 13), include/exclude duplicate blocking both directions (Tasks 6-7), 6-step wizard with progress bar and free navigation on visited steps (Task 10), same wizard for create and edit (Task 10 test 4), backend keeps per-keyword OR logic just nested per city (Task 13), profile list card shows domain badge + city list (Task 11). All covered.
- **Type consistency:** `SearchLocation`, `WizardModalProps`, and each step's prop interface use the same field names (`ville`, `rayon_km`, `domaineKey`, `domaineAutre`, `conflictsWith`) consistently across Tasks 4-10.
- **No placeholders:** every task has complete, runnable code — no TBD/TODO, no "similar to Task N" shortcuts.
