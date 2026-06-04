# UI/UX Redesign — JobTrackeria
**Date:** 2026-06-04  
**Approche choisie:** B — Redesign complet  
**Stack:** Next.js 16 / Tailwind v4 / GSAP / Supabase

---

## Décisions de design

| Paramètre | Valeur |
|---|---|
| Thème | Light mode |
| Fond page | `#f4f4f5` (zinc-100) |
| Fond cards | `white` |
| Texte principal | `#18181b` (zinc-900) |
| Texte secondaire | `#71717a` (zinc-500) |
| Accent principal | `#6366f1` (indigo-500) |
| Accent hover | `#4f46e5` (indigo-600) |
| Font | Outfit (existant) |
| Animations | GSAP subtil — fade+slide load, hover lift, async spinners |
| Responsive | Desktop + mobile (hamburger sidebar) |

---

## Scope des changements

### 1. Thème global (`app/globals.css`)

Remplacer toutes les CSS variables dark par les valeurs light :

```css
:root {
  --background: #f4f4f5;     /* zinc-100 */
  --surface:    #fafafa;     /* zinc-50 */
  --card:       #ffffff;
  --card-hover: #f9f9f9;
  --border:     #e4e4e7;     /* zinc-200 */
  --border-light: #d4d4d8;  /* zinc-300 */
  --accent:     #6366f1;     /* indigo-500 */
  --accent-light: #818cf8;  /* indigo-400 */
  --accent-dim: rgba(99,102,241,0.1);
  --foreground: #18181b;     /* zinc-900 */
  --foreground-dim: #52525b; /* zinc-600 */
  --muted:      #71717a;     /* zinc-500 */
  --muted-light: #a1a1aa;   /* zinc-400 */
  --success:    #16a34a;
  --warning:    #d97706;
  --danger:     #ef4444;
}
```

Supprimer `body::before` (dot grid purple) et `body::after` (ambient glow) — trop "IA sombre".

Ajouter règle hover nav manquante :
```css
.nav-item:hover {
  background: var(--accent-dim);
  color: var(--foreground);
}
.nav-item-logout:hover {
  background: rgba(239,68,68,0.08);
  color: #ef4444;
}
```

### 2. Nav (`components/layout/Nav.tsx`)

**Problèmes actuels :** hover invisible, pas de mobile, logout indistinguable.

**Changements :**
- Ajouter classe `nav-item-logout` au bouton déconnexion
- Sidebar desktop : largeur `w-56` → labels visibles
- Mobile : sidebar cachée, hamburger button dans header fixe, drawer avec overlay
- Logout en bas avec séparateur rouge au hover
- GSAP : `gsap.from('.nav-item', { x: -10, opacity: 0, stagger: 0.04 })` au mount

### 3. Form recherche (`app/search/page.tsx` + nouveau `components/search/ProfileModal.tsx`)

**Problèmes actuels :** form inline pousse layout, keywords = CSV input.

**Changements :**

**a) `ProfileModal.tsx`** — nouveau composant modal :
- Overlay `fixed inset-0 bg-zinc-900/30` avec fermeture au clic extérieur
- Card `bg-white rounded-2xl shadow-xl` centrée
- GSAP : `gsap.from(modal, { scale: 0.95, opacity: 0, duration: 0.2 })`

**b) Champ mots-clés** — `TagInput` component :
- Input texte inline dans une div pill-container
- `onKeyDown: e.key === 'Enter' || e.key === ','` → ajoute tag
- Tags affichés comme pills `bg-indigo-50 text-indigo-700` avec bouton ×
- Suggestions statiques sous le champ (clic → ajoute tag) :
  `['magasinier', 'préparateur de commandes', 'cariste', 'manutention', 'agent logistique', 'chauffeur livreur', 'opérateur production']`

**c) Champ qualifications** — même `TagInput` component, couleur bleue (`bg-blue-50 text-blue-700`) :
- Suggestions : `['Permis B', 'Permis C', 'Port de charges', 'Horaires décalés', '2x8/3x8', 'Travail de nuit', 'Travail weekend', 'Débutant accepté']`
- Stocké dans nouveau champ DB `qualifications text[]`
- Passé à JSearch comme keywords supplémentaires dans `lib/scrapers/jsearch.ts`

**d) Champ durée mission** — select standard :
- Options : `['peu_importe', '1_3_mois', '3_6_mois', '6_plus']`
- Stocké dans nouveau champ DB `duree_contrat text`
- JSearch n'a pas de filtre durée natif → champ purement indicatif pour l'instant, non transmis à l'API. Peut servir de filtre post-fetch si les titres contiennent "3 mois" etc. (hors scope v1)

**e) Bouton "Lancer maintenant"** — états async :
- Default: `↻ Lancer`
- Loading: spinner CSS + `Recherche...` + `disabled`
- Success: `✓ N offres ajoutées` (vert, 3s puis reset)
- Error: `✕ Message erreur` (rouge, 3s puis reset)

### 4. Offres (`app/offers/page.tsx` + `components/offers/OfferCard.tsx`)

**Problèmes actuels :** `<select>` natifs hors-thème, cards trop denses.

**Changements :**

**a) Filtres** — remplacer `<select>` par pill buttons :
```tsx
// Statut pills
{STATUS_OPTIONS.map(opt => (
  <button
    key={opt.value}
    onClick={() => setFilterStatus(opt.value)}
    className={filterStatus === opt.value ? 'pill-active' : 'pill'}
  >
    {opt.label}
  </button>
))}
```
CSS : `.pill { border border-zinc-200 rounded-md px-3 py-1.5 text-sm text-zinc-600 bg-white hover:bg-zinc-50 }` / `.pill-active { bg-zinc-900 text-white }`

**b) OfferCard** — aéré, zinc theme :
- Fond `bg-white border border-zinc-200 rounded-xl`
- Hover : `hover:shadow-md hover:border-zinc-300 transition-all`
- GSAP stagger sur mount : `gsap.from('.offer-card', { y: 12, opacity: 0, stagger: 0.05 })`
- Bouton "Ignorer" → inline confirm (`state: 'confirming'`) au lieu de `confirm()` natif

### 5. Boutons — système d'états complet

Toutes les actions async utilisent le pattern :

```tsx
type BtnState = 'idle' | 'loading' | 'success' | 'error'
const [state, setState] = useState<BtnState>('idle')

const handleClick = async () => {
  setState('loading')
  try {
    await action()
    setState('success')
    setTimeout(() => setState('idle'), 3000)
  } catch {
    setState('error')
    setTimeout(() => setState('idle'), 3000)
  }
}
```

Applicable à : Lancer scraping, Sync Gmail, Sauvegarder clé Groq, Postuler offre.

**Suppression** — pattern inline confirm au lieu de `window.confirm()` :
- Clic "Supprimer" → affiche bandeau rouge inline avec "Confirmer / Annuler"
- 5s timeout → auto-annule
- Concerne : suppression profil, suppression candidature

### 6. Migrations DB Supabase

Deux nouvelles colonnes sur `search_profiles` :

```sql
ALTER TABLE search_profiles
  ADD COLUMN qualifications text[] DEFAULT '{}',
  ADD COLUMN duree_contrat text DEFAULT 'peu_importe';
```

Mettre à jour `lib/supabase/types.ts` → `SearchProfile` interface.

Mettre à jour `lib/scrapers/jsearch.ts` → intégrer `qualifications` dans la query.

### 7. Mobile responsive

- `Nav.tsx` : `hidden lg:flex` sur sidebar desktop
- Nouveau `MobileHeader.tsx` : barre fixe avec hamburger + logo
- Drawer mobile : `fixed inset-0 z-50`, sidebar glisse depuis la gauche (GSAP `x: -240 → 0`)
- `AppShell.tsx` : inclure `MobileHeader` quand `isAuthenticated`
- `main` : `ml-0 lg:ml-56` au lieu de `ml-56` fixe

---

## Fichiers à créer

- `components/search/ProfileModal.tsx` — modal form profil
- `components/ui/TagInput.tsx` — tag pills input réutilisable
- `components/ui/AsyncButton.tsx` — bouton avec états idle/loading/success/error
- `components/ui/InlineConfirm.tsx` — confirm inline rouge
- `components/layout/MobileHeader.tsx` — header mobile hamburger

## Fichiers à modifier

- `app/globals.css` — variables light + hover nav
- `components/layout/Nav.tsx` — hover states + mobile hide
- `components/layout/AppShell.tsx` — MobileHeader
- `app/search/page.tsx` — utilise ProfileModal
- `app/offers/page.tsx` — pill filters
- `components/offers/OfferCard.tsx` — zinc theme + inline confirm
- `components/applications/ApplicationsTable.tsx` — zinc theme + inline confirm delete
- `lib/supabase/types.ts` — SearchProfile + qualifications/duree_contrat
- `lib/scrapers/jsearch.ts` — qualifications dans query
- `app/api/search-profiles/route.ts` — accepter `qualifications` et `duree_contrat` dans POST/PATCH body, les passer à Supabase insert/update

## Fichiers non touchés

- `app/page.tsx` (dashboard — déjà bien structuré)
- `components/applications/KanbanBoard.tsx`
- `app/settings/page.tsx`
- `app/login/page.tsx`
- Toutes les routes API sauf `search-profiles`

---

## GSAP — plan d'animation

| Élément | Animation | Trigger |
|---|---|---|
| Nav items | `x:-10, opacity:0, stagger:0.04` | mount |
| Profile cards | `y:8, opacity:0, stagger:0.06` | mount + après fetch |
| Offer cards | `y:12, opacity:0, stagger:0.05` | mount + filtre change |
| Modal open | `scale:0.95, opacity:0, duration:0.2` | show |
| Modal close | `scale:0.95, opacity:0` reverse | hide |
| Tag pill ajout | `scale:0 → 1, duration:0.15` | onAdd |
| Tag pill suppression | `scale:1 → 0, duration:0.1` | onRemove |
| Drawer mobile | `x:-240 → 0, duration:0.25` | open |

Pas de `ScrollTrigger`, pas d'animations de page complexes — subtil uniquement.

---

## Hors scope

- Dashboard (`app/page.tsx`) — inchangé
- Toast system global — non inclus (les états inline suffisent)
- Dark mode toggle — non inclus
- KanbanBoard redesign — non inclus
- Settings page redesign — non inclus
