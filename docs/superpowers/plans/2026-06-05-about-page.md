# About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/about` page with features presentation, data transparency, and voice assistant FAQ — accessible with or without login.

**Architecture:** Static server component at `app/about/page.tsx` with two client sub-components (`AboutTabs` sticky nav, `FaqAccordion`). Middleware and AppShell updated to treat `/about` as public. Login page gains two entry points.

**Tech Stack:** Next.js 15 App Router, Tailwind v4, GSAP (already installed), TypeScript

---

### Task 1: Update middleware + AppShell to allow public `/about`

**Files:**
- Modify: `middleware.ts`
- Modify: `components/layout/AppShell.tsx`

- [ ] **Step 1: Update `middleware.ts` `isPublic` check**

```typescript
// middleware.ts — replace line 27
const isPublic = pathname === '/login' || pathname === '/about' || pathname.startsWith('/auth/')
```

- [ ] **Step 2: Update `AppShell.tsx` PUBLIC_PATHS**

```typescript
// components/layout/AppShell.tsx — replace line 8
const PUBLIC_PATHS = ['/login', '/auth']
```

Note: `/about` is NOT in PUBLIC_PATHS — when logged in, the user gets the full AppShell with sidebar. Only unauthenticated users see the bare layout (middleware lets them through, AppShell renders `<div>{children}</div>` because `isAuthenticated` is false).

- [ ] **Step 3: Verify logic is correct**

| Scenario | Middleware | AppShell result |
|----------|-----------|----------------|
| Not logged in, visits `/about` | Passes through | Bare (no nav) |
| Logged in, visits `/about` | Passes through | Full nav |
| Not logged in, visits `/` | Redirect → `/login` | — |

- [ ] **Step 4: Commit**

```bash
git add middleware.ts components/layout/AppShell.tsx
git commit -m "feat(about): allow public access to /about route"
```

---

### Task 2: Add `FaqAccordion` client component

**Files:**
- Create: `components/about/FaqAccordion.tsx`

- [ ] **Step 1: Create component**

```typescript
// components/about/FaqAccordion.tsx
'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: "Comment Alex comprend ma voix ?",
    a: "Votre navigateur enregistre votre voix via MediaRecorder. L'audio est envoyé à Groq Whisper (whisper-large-v3-turbo) qui le transcrit en texte, puis LLaMA 3.3 70B analyse l'intention et exécute l'action."
  },
  {
    q: "Mon audio est-il stocké ?",
    a: "Non. L'audio ne quitte jamais le serveur après transcription. Seul un log textuel minimal est conservé pour le débogage — sans le contenu audio ni la transcription complète."
  },
  {
    q: "Pourquoi Groq et pas Google ?",
    a: "L'API Web Speech de Chrome envoie l'audio aux serveurs Google, ce qui peut être bloqué sur certains réseaux. Groq est une alternative directe, plus fiable et privée."
  },
  {
    q: "Alex peut-il modifier mes candidatures ?",
    a: "Oui — il peut mettre à jour le statut, ajouter une note, ou créer une nouvelle candidature. Les actions irréversibles (ex: marquer comme refus) demandent une confirmation explicite."
  },
  {
    q: "Que faire si Alex se trompe ?",
    a: "Cliquez sur la croix pour ignorer la réponse. Toutes les modifications sont visibles immédiatement et peuvent être corrigées manuellement dans l'interface."
  },
  {
    q: "Alex fonctionne-t-il sans micro ?",
    a: "Non. Alex est un assistant vocal et requiert l'accès au microphone. Autorisez l'accès dans les paramètres de votre navigateur (icône cadenas dans la barre d'adresse)."
  },
]

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => (
        <div
          key={i}
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(124,58,237,0.2)', background: 'rgba(16,18,32,0.6)' }}
        >
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-sm font-medium" style={{ color: '#e8eaf5' }}>{faq.q}</span>
            <span
              className="flex-shrink-0 transition-transform duration-200"
              style={{
                color: '#7c3aed',
                transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 4v16m8-8H4" />
              </svg>
            </span>
          </button>
          {open === i && (
            <div className="px-5 pb-4">
              <p className="text-sm leading-relaxed" style={{ color: '#8b92b8' }}>{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/about/FaqAccordion.tsx
git commit -m "feat(about): add FaqAccordion client component"
```

---

### Task 3: Add `AboutTabs` sticky nav client component

**Files:**
- Create: `components/about/AboutTabs.tsx`

- [ ] **Step 1: Create component**

```typescript
// components/about/AboutTabs.tsx
'use client'

import { useState, useEffect } from 'react'

const TABS = [
  { id: 'features', label: 'Fonctionnalités' },
  { id: 'data', label: 'Données & Confidentialité' },
  { id: 'faq', label: 'FAQ Alex' },
]

export function AboutTabs() {
  const [active, setActive] = useState('features')

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    TABS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id) },
        { rootMargin: '-40% 0px -55% 0px' }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [])

  return (
    <div
      className="sticky top-0 z-20 flex justify-center gap-1 py-3 px-4"
      style={{ background: 'rgba(8,9,14,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(124,58,237,0.1)' }}
    >
      {TABS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={() => setActive(id)}
          className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
          style={{
            background: active === id ? 'rgba(124,58,237,0.2)' : 'transparent',
            color: active === id ? '#a78bfa' : '#4b5175',
            border: `1px solid ${active === id ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
          }}
        >
          {label}
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/about/AboutTabs.tsx
git commit -m "feat(about): add AboutTabs sticky nav with IntersectionObserver"
```

---

### Task 4: Build `app/about/page.tsx`

**Files:**
- Create: `app/about/page.tsx`

- [ ] **Step 1: Create page**

```typescript
// app/about/page.tsx
import Link from 'next/link'
import { AboutTabs } from '@/components/about/AboutTabs'
import { FaqAccordion } from '@/components/about/FaqAccordion'

const FEATURES = [
  {
    icon: '📊',
    title: 'Dashboard',
    desc: "Vue d'ensemble de vos candidatures avec statistiques de progression en temps réel.",
  },
  {
    icon: '🔍',
    title: 'Scraping automatique',
    desc: "Recherche quotidienne sur JSearch, APEC, France Travail et HelloWork selon vos profils.",
  },
  {
    icon: '📋',
    title: 'Gestion des offres',
    desc: "Consultez les détails complets, filtrez, sauvegardez et archivez les offres pertinentes.",
  },
  {
    icon: '✉️',
    title: 'Suivi des candidatures',
    desc: "Statuts, notes et relances — historique complet de chaque candidature en un endroit.",
  },
  {
    icon: '🎤',
    title: 'Alex — Assistant IA',
    desc: "Dictez des commandes vocales en français pour mettre à jour vos candidatures instantanément.",
  },
  {
    icon: '🔒',
    title: 'Sécurité',
    desc: "Authentification Google OAuth, données chiffrées Supabase EU, headers HTTP renforcés.",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: '#08090e', color: '#e8eaf5' }}>
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Ambient glow top */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 pointer-events-none" style={{
        width: '600px', height: '300px',
        background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)',
      }} />

      <div className="relative">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="flex flex-col items-center text-center px-6 pt-20 pb-14">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
            boxShadow: '0 0 40px rgba(124,58,237,0.4), 0 0 0 1px rgba(124,58,237,0.3)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">JobTracker IA</h1>
          <p className="text-lg max-w-lg mb-8" style={{ color: '#8b92b8' }}>
            Gérez votre recherche d&apos;emploi avec intelligence, en toute transparence.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 0 20px rgba(124,58,237,0.35)' }}
            >
              Se connecter
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #242847', color: '#8b92b8' }}
            >
              ← Retour
            </Link>
          </div>
        </section>

        {/* ── Sticky tab nav ────────────────────────────────── */}
        <AboutTabs />

        {/* ── Section: Fonctionnalités ──────────────────────── */}
        <section id="features" className="max-w-4xl mx-auto px-6 py-16" style={{ scrollMarginTop: '56px' }}>
          <h2 className="text-2xl font-bold mb-2">Fonctionnalités</h2>
          <p className="mb-10" style={{ color: '#8b92b8' }}>Tout ce dont vous avez besoin pour une recherche d&apos;emploi structurée.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl p-5 transition-all group"
                style={{ background: 'rgba(16,18,32,0.7)', border: '1px solid rgba(124,58,237,0.12)' }}
              >
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-semibold mb-1.5 text-sm">{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section: Données ─────────────────────────────── */}
        <section id="data" className="max-w-4xl mx-auto px-6 py-16" style={{ scrollMarginTop: '56px' }}>
          <h2 className="text-2xl font-bold mb-2">Données & Confidentialité</h2>
          <p className="mb-10" style={{ color: '#8b92b8' }}>Nous croyons en une transparence totale sur l&apos;usage de vos données.</p>
          <div className="space-y-4">
            {/* Bloc 1 */}
            <div className="rounded-xl p-6" style={{ background: 'rgba(16,18,32,0.7)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🏗️</span>
                <h3 className="font-semibold text-sm">Où vont vos données ?</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: '#8b92b8' }}>
                <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>›</span> Hébergement : <strong style={{ color: '#e8eaf5' }}>Supabase (région Europe)</strong> — données isolées par compte</li>
                <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>›</span> Authentification : <strong style={{ color: '#e8eaf5' }}>Google OAuth</strong> — aucun mot de passe stocké</li>
                <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>›</span> Déploiement : <strong style={{ color: '#e8eaf5' }}>Netlify CDN Europe</strong></li>
              </ul>
            </div>
            {/* Bloc 2 */}
            <div className="rounded-xl p-6" style={{ background: 'rgba(16,18,32,0.7)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">✅</span>
                <h3 className="font-semibold text-sm">Ce que nous ne faisons pas</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: '#8b92b8' }}>
                <li className="flex gap-2"><span style={{ color: '#22c55e' }}>✗</span> Pas de revente de données à des tiers</li>
                <li className="flex gap-2"><span style={{ color: '#22c55e' }}>✗</span> Pas de tracking publicitaire ni d&apos;analytics tiers</li>
                <li className="flex gap-2"><span style={{ color: '#22c55e' }}>✗</span> Pas d&apos;accès à vos données par d&apos;autres utilisateurs</li>
                <li className="flex gap-2"><span style={{ color: '#22c55e' }}>✗</span> Pas d&apos;entraînement de modèles IA sur vos données</li>
              </ul>
            </div>
            {/* Bloc 3 */}
            <div className="rounded-xl p-6" style={{ background: 'rgba(16,18,32,0.7)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎤</span>
                <h3 className="font-semibold text-sm">Données audio (assistant Alex)</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: '#8b92b8' }}>
                <li className="flex gap-2"><span style={{ color: '#60a5fa' }}>›</span> L&apos;audio capturé est envoyé directement à <strong style={{ color: '#e8eaf5' }}>Groq Whisper</strong> pour transcription</li>
                <li className="flex gap-2"><span style={{ color: '#60a5fa' }}>›</span> Groq ne stocke pas les fichiers audio après transcription</li>
                <li className="flex gap-2"><span style={{ color: '#60a5fa' }}>›</span> Seule la transcription textuelle transite côté serveur pour générer la réponse</li>
                <li className="flex gap-2"><span style={{ color: '#60a5fa' }}>›</span> <strong style={{ color: '#e8eaf5' }}>Aucun audio, aucune transcription</strong> n&apos;est sauvegardé en base de données</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Section: FAQ ─────────────────────────────────── */}
        <section id="faq" className="max-w-4xl mx-auto px-6 py-16" style={{ scrollMarginTop: '56px' }}>
          <h2 className="text-2xl font-bold mb-2">FAQ — Assistant Alex</h2>
          <p className="mb-10" style={{ color: '#8b92b8' }}>Tout ce que vous devez savoir sur l&apos;assistant vocal.</p>
          <FaqAccordion />
        </section>

        {/* ── Footer CTA ───────────────────────────────────── */}
        <section className="flex flex-col items-center text-center px-6 py-20">
          <h2 className="text-2xl font-bold mb-3">Prêt à commencer ?</h2>
          <p className="mb-8" style={{ color: '#8b92b8' }}>Connectez-vous pour accéder à votre espace de suivi de candidatures.</p>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}
          >
            Se connecter avec Google
          </Link>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc to verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/about/page.tsx
git commit -m "feat(about): add /about page with features, data transparency and FAQ"
```

---

### Task 5: Update login page — add entry points to `/about`

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Add import and secondary button**

After the Google login `<button>` block (line ~97), add a secondary link button:

```tsx
// After the existing Google login button
<Link
  href="/about"
  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
  style={{
    background: 'transparent',
    border: '1px solid #1a1d32',
    color: '#6b7280',
  }}
>
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  En savoir plus sur JobTracker IA
</Link>
```

Add `import Link from 'next/link'` at top if not present.

- [ ] **Step 2: Add footer link**

Replace the existing footer `<p>` (last element before closing `</div>`):

```tsx
<p className="text-center text-xs mt-6" style={{ color: '#2a2f4a' }}>
  JobTracker IA ·{' '}
  <Link href="/about" className="hover:underline" style={{ color: '#4b5175' }}>
    Comment ça fonctionne ?
  </Link>
</p>
```

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(about): add entry points from login page to /about"
```

---

### Task 6: Add "À propos" link in sidebar Nav

**Files:**
- Modify: `components/layout/Nav.tsx`

- [ ] **Step 1: Add link at bottom of nav footer, above logout button**

In the footer `<div>` (around line 147), add before the logout button:

```tsx
<Link
  href="/about"
  className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
  style={{ color: 'var(--muted)' }}
>
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  À propos
</Link>
```

- [ ] **Step 2: Run full test suite**

```bash
npx tsc --noEmit && npx jest --no-coverage
```

Expected: 0 type errors, 28/28 tests pass.

- [ ] **Step 3: Final commit**

```bash
git add components/layout/Nav.tsx
git commit -m "feat(about): add À propos link in sidebar nav"
```

---

### Task 7: Smoke test

- [ ] Run `npm run dev`
- [ ] Visit `http://localhost:3000/about` without being logged in → bare page, no sidebar
- [ ] Visit login page → see "En savoir plus" button and footer link
- [ ] Log in → revisit `/about` → sidebar nav visible
- [ ] Scroll through all 3 sections → sticky tabs highlight correctly
- [ ] Click FAQ items → open/close accordion
- [ ] `npm run build` → must succeed with 0 errors
