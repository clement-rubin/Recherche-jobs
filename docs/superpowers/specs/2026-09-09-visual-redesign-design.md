# Visual redesign — "moderne avec profondeur" — design spec

Date: 2026-09-09

## Problem

JobTrackeria's UI is a light zinc theme that still carries substantial dark-theme residue from an earlier design. This produces three classes of problem:

1. **Accessibility failures.** Colors tuned for dark backgrounds are used as foreground on light surfaces. `Badge.tsx` renders every status with translucent dark-mode classes (`bg-indigo-500/20 text-indigo-300`); four files render error banners as `text-red-400` on white; the dashboard shows stat values in pastels (`#fbbf24` ≈ 1.8:1, `#34d399` ≈ 2:1, `#a78bfa` ≈ 2.5:1). All fail WCAG AA (4.5:1).
2. **Incoherence.** Two competing brand colors exist — `--accent: #6366f1` versus hardcoded violet `#7c3aed` (focus rings, `pulse-glow`, `.gradient-text`) and a third `indigo-500/600/700` family in `AsyncButton` and settings. `.glass` is `rgba(16,18,32,0.7)` — a dark navy panel defined in a light theme. `app/login/page.tsx` and `app/about/page.tsx` are still *entirely* dark-themed, so clicking "À propos" in the sidebar jumps from a light app to a dark page.
3. **No system.** Shadows are one-off literals ranging from `rgba(0,0,0,0.06)` to `rgba(0,0,0,0.5)` with no scale. `--radius: 10px` is declared and never used while components pick `rounded-lg`/`xl`/`2xl` ad hoc, including one literal `rounded-[16px]`. Three modals hand-roll identical chrome. `SOURCE_LABELS` is redefined in three files.

Goal: a coherent, modern visual system with deliberate depth — and AA contrast throughout.

## Direction and scope (decided with user)

- **Aesthetic:** "moderne avec profondeur" — layered elevation, subtle surface gradients, generous radii, warmer contrast. Not flat-minimal, not expressive/gradient-heavy.
- **Dark mode:** explicitly **out of scope**. Light theme only. Do not add `prefers-color-scheme` blocks or a theme toggle.
- **Scope:** full pass — every page and shared component.
- **Login + À propos:** converted to the light theme. No dark "brand moment" is retained.
- **Dashboard stat cards:** the numeric value renders in `--foreground` (maximum legibility); color is carried by the icon, the label and a top accent rule — not by the number itself.

## Foundations — `app/globals.css`

### Elevation scale

Every shadow becomes a two-layer pair (tight contact shadow + soft ambient), tinted with zinc-900 rather than pure black so it reads warm rather than sooty. This is the primary vehicle for "profondeur".

```css
--shadow-xs: 0 1px 2px rgba(24, 24, 27, 0.04), 0 1px 1px rgba(24, 24, 27, 0.03);
--shadow-sm: 0 1px 3px rgba(24, 24, 27, 0.05), 0 2px 6px rgba(24, 24, 27, 0.04);
--shadow-md: 0 2px 6px rgba(24, 24, 27, 0.06), 0 6px 16px rgba(24, 24, 27, 0.05);
--shadow-lg: 0 4px 12px rgba(24, 24, 27, 0.07), 0 12px 32px rgba(24, 24, 27, 0.06);
--shadow-xl: 0 8px 24px rgba(24, 24, 27, 0.08), 0 24px 56px rgba(24, 24, 27, 0.08);
--shadow-accent: 0 4px 16px rgba(99, 102, 241, 0.24);
```

Assignment: cards at rest `--shadow-sm`, card hover `--shadow-md`, dropdowns/popovers `--shadow-lg`, modals `--shadow-xl`, primary buttons `--shadow-accent` on hover. No component may define its own `boxShadow` literal.

### Radius scale

```css
--r-sm:  6px;   /* badges, chips */
--r-md:  8px;   /* inputs, small buttons */
--r-lg:  12px;  /* buttons, list rows */
--r-xl:  16px;  /* cards, panels */
--r-2xl: 20px;  /* modals, hero surfaces */
```

The orphan `--radius: 10px` is removed. The literal `rounded-[16px]` in `SwipeCard.tsx` becomes `--r-xl`.

### Semantic color tokens

Each status gets a triplet — text (AA on white), surface tint, border tint — so banners and badges stop hand-rolling Tailwind opacity classes:

```css
--success-text: #15803d;  --success-surface: rgba(22, 163, 74, 0.08);   --success-border: rgba(22, 163, 74, 0.22);
--warning-text: #b45309;  --warning-surface: rgba(217, 119, 6, 0.08);  --warning-border: rgba(217, 119, 6, 0.22);
--danger-text:  #b91c1c;  --danger-surface:  rgba(239, 68, 68, 0.08);  --danger-border:  rgba(239, 68, 68, 0.22);
--accent-text:  #4f46e5;  --accent-surface:  rgba(99, 102, 241, 0.08); --accent-border:  rgba(99, 102, 241, 0.22);
```

All four text values clear 4.5:1 on white and on their own 8% surface tint. Implementation must verify with a contrast checker rather than trusting these numbers.

### Depth surfaces

```css
--card-gradient: linear-gradient(180deg, #ffffff 0%, #fcfcfd 100%);
--surface-raised: #ffffff;
```

Cards use `--card-gradient` + 1px `--border` + `--shadow-sm`. The gradient is deliberately near-imperceptible — it reads as light falling on the surface, not as a decorative gradient.

### Cleanup

- `.glass` — the dark navy rule — is deleted (only `MobileHeader` needs glass; it defines its own correct light value).
- `pulse-glow`, `.gradient-text`, and the input focus ring switch from violet `124,58,237` to `--accent`.
- `.stat-card:hover`'s `rgba(0,0,0,0.35)` becomes `--shadow-md`.
- The pre-existing `--accent-dim` (`rgba(99,102,241,0.1)`) is superseded by `--accent-surface` (`0.08`); `--accent-dim` is removed and its call sites (Nav active state, wizard progress bar, analyze info boxes) repointed, so only one accent tint exists.
- The pre-existing `--accent-glow` is superseded by `--shadow-accent` and removed; its one call site is the Nav logo badge.

## Shared primitives

| Component | Status | Responsibility |
|---|---|---|
| `components/ui/Modal.tsx` | **new** | Overlay, centered card (`--r-2xl`, `--shadow-xl`), header with title + close button, optional footer. Mobile: bottom-sheet variant (`rounded-t-2xl`). Consumed by `OfferDetailModal`, `WizardModal`, `ApplicationForm`. |
| `components/ui/Badge.tsx` | rebuilt | Semantic tokens instead of ten hardcoded Tailwind color families. AA contrast on `--card`. |
| `components/ui/AsyncButton.tsx` | extended | Variants `primary` \| `secondary` \| `ghost` \| `danger`, all on tokens. Replaces the ad-hoc button styles scattered across pages. |
| `components/ui/Card.tsx` | **new** | The card surface (gradient + border + `--shadow-sm`, hover `--shadow-md`). Used by offers, dashboard, settings, search. |
| `lib/offers/sources.ts` | **new** | Single `SOURCE_LABELS` map, currently duplicated in `OfferCard`, `OfferDetailModal`, `SwipeCard`. |

## Page treatment

- **Dashboard** (`app/page.tsx`) — stat value in `--foreground`; color moves to icon + label + a 2px top accent rule per card. Cards get the new elevation. Removes every hardcoded pastel and the violet gradient bar.
- **Offres** (`app/offers/page.tsx`, `OfferCard`, `OfferDetailModal`, `SwipeCard`, `SwipeDeck`, `ViewToggle`) — unify the two filter-pill rows onto one selected-state convention (`--accent`); error banner onto `--danger-*`; `SwipeCard`'s inline shadow/color literals onto tokens; the swipe overlay palette (`#4ade80`/`#f87171`/`#fbbf24`) onto semantic tokens.
- **Candidatures** (`app/applications/page.tsx`, `ApplicationForm`, `ApplicationsTable`, `KanbanBoard`) — `text-red-400` banners onto `--danger-*`; `hover:bg-zinc-100`/`hover:bg-red-50` onto tokens; form adopts `Modal`.
- **Recherche** (`app/search/page.tsx`, `WizardModal`) — unicode glyphs (`↻`, `✕`, `+`) replaced with SVG icons; green Tailwind badges onto `--success-*`; wizard adopts `Modal`.
- **Analyser** (`app/analyze/page.tsx`) — emoji icons (📍, ⚠️) replaced with SVG; `ScoreGauge` and section cards onto the elevation scale.
- **Paramètres** (`app/settings/page.tsx`) — `hover:bg-indigo-700` onto `--accent`; translucent banners onto semantic tokens.
- **Login + À propos** (`app/login/page.tsx`, `app/about/page.tsx`) — converted from dark to light: `#08090e` backgrounds, `rgba(16,18,32,*)` glass cards, violet gradients and `rgba(0,0,0,0.5)` shadows all replaced with tokens. Emoji icons in About (🏗️, ✅, 🎤) replaced with the Lucide icons already used elsewhere on that page.
- **Nav / MobileHeader** — adopt the elevation and radius scales; otherwise structurally sound, no rework.

## Accessibility requirements

Non-negotiable, verified before the work is called done:

- Every text/background pair ≥ 4.5:1 (≥ 3:1 for text ≥ 24px or bold ≥ 19px).
- Focus rings remain visible on every interactive element and use `--accent`.
- Status is never conveyed by color alone — badges keep their text label.
- Touch targets ≥ 44×44px.
- `prefers-reduced-motion` handling in `globals.css` is preserved as-is.

## Non-goals

- Dark mode, in any form.
- Restructuring page layouts, navigation, or information architecture — this is a visual/system pass, not a UX redesign. Element positions stay put except where a shared primitive replaces duplicated chrome.
- Changing copy, data flow, API routes, or scrapers.
- Swapping the icon set or adding an icon library beyond the Lucide already present.

## Testing

- Existing suite (21 files, 97 tests) must stay green; component tests that assert on hardcoded class names get updated alongside their component.
- `Badge`, `AsyncButton`, `Modal` and `Card` each get unit tests covering their variants and, for `Modal`, close-on-overlay-click and escape handling.
- Visual verification in the browser at 375px, 768px and 1440px, plus a `prefers-reduced-motion` pass.
