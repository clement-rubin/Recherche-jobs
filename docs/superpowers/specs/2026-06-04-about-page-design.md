# About Page — Design Spec
**Date:** 2026-06-04  
**Status:** Approved

## Goal

Add a public `/about` page presenting JobTrackeria's features, data transparency, and a voice assistant (Alex) FAQ. Accessible without login and when logged in. Linked from the login page.

---

## Routing & Access

| Path | Auth required | AppShell nav |
|------|--------------|--------------|
| `/about` | No | Only when logged in |

**Middleware** (`middleware.ts`): add `/about` to `isPublic` check so unauthenticated users are not redirected.

**AppShell** (`components/layout/AppShell.tsx`): current `PUBLIC_PATHS = ['/login', '/auth']`. Change logic: render full AppShell with nav when `isAuthenticated`, regardless of path — except `/login` and `/auth` which always render bare. This means a logged-in user visiting `/about` gets the sidebar; a non-logged-in user gets the full-width page.

**Login page** (`app/login/page.tsx`):
- Add secondary button above Google login: "En savoir plus sur JobTracker IA" → `href="/about"`
- Add footer link below card: "Comment ça fonctionne ?" → `href="/about"`

**Nav sidebar** (`components/layout/Nav.tsx`): add "À propos" link at the bottom of the nav list.

---

## Page Structure (`app/about/page.tsx`)

Server component. Static content, zero fetches. Same dark aesthetic as login (`#08090e` background, violet grid, ambient glows).

### Layout

```
Hero
Sticky tab nav  (#features | #data | #faq)
Section #features
Section #data
Section #faq
Footer CTA
```

### Hero

- Logo icon + "JobTracker IA" title
- Tagline: "Gérez votre recherche d'emploi avec intelligence, en toute transparence"
- Two buttons: "Se connecter" (`/login`) · "Retour" (back, only if referrer exists — use plain `href="/login"`)

### Sticky Tab Nav

Three anchor links that highlight based on scroll position (client component or pure CSS `:target`). Tabs: **Fonctionnalités** · **Données & Confidentialité** · **FAQ Alex**.

Implementation: `'use client'` child component `AboutTabs` with `IntersectionObserver` to highlight the active tab as user scrolls. Sections get `scroll-margin-top` to offset the sticky nav height.

### Section #features — 6 cards

| Icon | Title | Description |
|------|-------|-------------|
| 📊 | Dashboard | Vue d'ensemble de toutes vos candidatures et statistiques |
| 🔍 | Scraping automatique | Recherche quotidienne sur JSearch, APEC, France Travail, HelloWork |
| 📋 | Gestion des offres | Sauvegardez, filtrez et consultez les détails complets des offres |
| ✉️ | Suivi des candidatures | Statuts, notes, relances — tout en un seul endroit |
| 🎤 | Alex — Assistant IA | Dictez des commandes vocales pour mettre à jour vos candidatures |
| 🔒 | Sécurité | Authentification Google, données chiffrées, headers de sécurité renforcés |

Grid 2-col mobile / 3-col desktop. Card style: dark glass with violet border on hover.

### Section #data — 3 blocs

**Bloc 1 — Où vont tes données ?**
- Hébergement : Supabase (région Europe), données isolées par compte
- Authentification : Google OAuth (aucun mot de passe stocké)
- Déploiement : Netlify (CDN Europe)

**Bloc 2 — Ce qu'on ne fait pas**
- Pas de revente de données à des tiers
- Pas de tracking publicitaire ni d'analytics tiers
- Pas d'accès à tes données par d'autres utilisateurs
- Pas d'entraînement de modèles IA sur tes données

**Bloc 3 — Données audio (Alex)**
- L'audio capturé par le micro est envoyé directement à Groq Whisper pour transcription
- Groq ne stocke pas les fichiers audio après transcription (politique Groq)
- Seule la transcription textuelle transite brièvement côté serveur pour générer la réponse
- Aucun audio, aucune transcription n'est sauvegardé dans la base de données

### Section #faq — 6 items accordion

| Question | Réponse |
|----------|---------|
| Comment Alex comprend ma voix ? | Votre navigateur enregistre votre voix via MediaRecorder. L'audio est envoyé à Groq Whisper (modèle whisper-large-v3-turbo) qui le transcrit en texte, puis un LLM (LLaMA 3.3 70B) analyse l'intention et exécute l'action. |
| Mon audio est-il stocké ? | Non. L'audio ne quitte jamais le serveur après transcription. Seul un log textuel minimal (intention + action) est conservé pour le débogage, sans le contenu audio ni la transcription complète. |
| Pourquoi Groq et pas Google ? | L'API Web Speech de Chrome envoie l'audio aux serveurs Google, ce qui peut être bloqué sur certains réseaux. Groq est une alternative directe, plus fiable et privée. |
| Alex peut-il modifier mes candidatures ? | Oui — il peut mettre à jour le statut, ajouter une note, ou créer une nouvelle candidature. Les actions irréversibles (ex: marquer comme refus) demandent une confirmation. |
| Que faire si Alex se trompe ? | Cliquez sur la croix pour ignorer la réponse. Toutes les modifications sont visibles immédiatement dans l'interface et peuvent être corrigées manuellement. |
| Alex fonctionne-t-il sans micro ? | Non. Alex est un assistant vocal et requiert l'accès au microphone. Vous pouvez autoriser l'accès dans les paramètres de votre navigateur. |

Accordion: expand/collapse on click, one item open at a time. Client component `FaqAccordion`.

### Footer CTA

"Prêt à commencer ?" + bouton "Se connecter" → `/login`.

---

## Components Created

| File | Type | Purpose |
|------|------|---------|
| `app/about/page.tsx` | Server component | Page shell + static content |
| `components/about/AboutTabs.tsx` | Client component | Sticky tab nav with IntersectionObserver |
| `components/about/FaqAccordion.tsx` | Client component | Expand/collapse FAQ |

---

## Files Modified

| File | Change |
|------|--------|
| `middleware.ts` | Add `/about` to `isPublic` |
| `components/layout/AppShell.tsx` | Treat `/about` as public (no nav) when not authenticated |
| `app/login/page.tsx` | Add "En savoir plus" button + footer link |
| `components/layout/Nav.tsx` | Add "À propos" link at bottom |

---

## Visual Style

Same as login page:
- Background: `#08090e`
- Grid: `radial-gradient(circle, rgba(124,58,237,0.07) 1px, transparent 1px)` 28px
- Ambient glows: violet top, blue bottom-right
- Card: `rgba(16,18,32,0.8)` border `#1a1d32` backdrop-blur
- Accent: `#7c3aed`
- Text: `#e8eaf5` / muted `#4b5175`

---

## Out of Scope

- No i18n
- No analytics on the page
- No contact form
- No cookie banner
