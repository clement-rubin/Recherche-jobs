# Swipe Fix + Responsive + Harmonisation GSAP/UI

**Date** : 2026-06-05  
**Scope** : `components/offers/SwipeCard.tsx`, `components/offers/SwipeDeck.tsx`, `app/search/page.tsx`, `components/search/ProfileModal.tsx`

---

## 1. SwipeDeck — Fix éventail (bug z-stacking)

### Problème

Architecture double-transform : `stackStyle` (rotation + zIndex) est appliqué au div **interne** de `SwipeCard`, tandis que GSAP anime le div **wrapper** de `SwipeDeck`. Après le premier swipe, les transforms sur les deux niveaux créent des stacking contexts conflictuels → la carte background (index 1) est masquée par la nouvelle carte top.

### Architecture cible

**SwipeDeck wrapper** possède tous les transforms de stack :

| stackIndex | rotation | scale | zIndex | transform-origin |
|-----------|----------|-------|--------|-----------------|
| 0 (top)   | 0deg     | 1     | 3      | bottom center   |
| 1 (mid)   | 3deg     | 0.97  | 2      | bottom center   |
| 2 (back)  | 6deg     | 0.94  | 1      | bottom center   |

Les cartes background ont `top: 0` identique — les coins rotatés dépassent latéralement grâce à `transform-origin: bottom center`, produisant l'effet éventail choisi.

**SwipeCard** root div :
- `position: relative` (plus `absolute`)
- Plus de `stackStyle` prop, plus de zIndex interne
- Gère uniquement les transforms de drag via son propre `cardRef` (GSAP x/y/rotation)

**Animation promote** — déclenchée dans le `useEffect([stack])`, PAS dans `handleAction` :

```typescript
// handleAction : capture nextTopId AVANT setStack, puis setStack seulement
const nextTopId = stack[1]?.id ?? null
setStack(prev => prev.filter(o => o.id !== id))
// → useEffect détecte le changement, applique gsap.set + fromTo
```

```typescript
// useEffect([stack]) — GSAP est seul propriétaire des transforms wrapper
cardRefs.current.forEach((el, stackIndex) => {
  if (!el) return
  const rotation = [0, 3, 6][stackIndex] ?? 0
  const scale    = [1, 0.97, 0.94][stackIndex] ?? 0.94
  gsap.set(el, { zIndex: 3 - stackIndex, transformOrigin: 'bottom center', force3D: true })
  if (stackIndex === 0 && prevTopIdRef.current !== null && prevTopIdRef.current !== stack[0]?.id) {
    // Carte venant d'être promue → animate depuis la position mid
    gsap.fromTo(el,
      { rotation: 3, scale: 0.97 },
      { rotation: 0, scale: 1, duration: 0.4, ease: 'back.out(1.2)', force3D: true }
    )
  } else {
    gsap.set(el, { rotation, scale })
  }
})
prevTopIdRef.current = stack[0]?.id ?? null
```

Avantage : aucun conflit possible entre `gsap.set` et `fromTo` — les deux vivent dans le même useEffect, exécutés séquentiellement.

### Deck container

- Hauteur : **360px** (vs 320px actuellement) — espace pour les coins rotatés
- `overflow: visible` (déjà le cas, à conserver)
- `maxWidth: 420px`, `margin: 0 auto`

### Performance GSAP

- `will-change: transform` appliqué via `gsap.set` sur la carte top (stackIndex 0) uniquement
- `force3D: true` sur toutes les animations de mouvement
- `gsap.context()` dans SwipeDeck pour cleanup groupé à l'unmount
- Drag : `gsap.quickSetter` pour `x`, `y`, `rotation` (évite le recalcul à chaque pointermove)

---

## 2. Responsive — Page Recherche (iPhone 12, 390px)

### Carte profil (`app/search/page.tsx`)

**Desktop** (≥ 640px) : layout inchangé — flex-row, boutons à droite.

**Mobile** (< 640px) :
```
flex-col
  ↳ bloc infos (nom + badge, localisation, mots-clés, contrats) — pleine largeur
  ↳ séparateur border-top
  ↳ row boutons : [Désactiver/Activer flex-1] [Éditer] [✕]
     min-height: 36px pour cibles tactiles conformes
```

### Header de page

- Bouton "↻ Lancer maintenant" → icône seule sur mobile : `<span class="sm:hidden">↻</span><span class="hidden sm:inline">↻ Lancer maintenant</span>`

### ProfileModal (`components/search/ProfileModal.tsx`)

| Propriété | Mobile | Desktop |
|-----------|--------|---------|
| Padding horizontal | `px-4` | `px-6` |
| Grids 2 colonnes | `grid-cols-1` | `sm:grid-cols-2` |
| Max height body | `max-h-[80vh]` | `max-h-[70vh]` |

### SwipeCard (mobile)

- Padding interne : 16px (vs 20px) sur mobile
- Description clamp : 3 lignes (vs 2)
- Action buttons : `py-2.5` minimum

---

## 3. Harmonisation GSAP perf + UI polish

### GSAP performance (règles gsap-performance)

- `force3D: true` sur toutes les animations de transform
- `gsap.context()` pour cleanup groupé (SwipeDeck)
- `gsap.quickSetter` pour drag pointermove — 3 setters distincts (x, y, rotation), appelés dans `onPointerMove` à la place de `gsap.set` (élimine re-parsing overhead par event)
- `will-change: transform` uniquement sur carte active (ajouté/retiré via gsap.set)
- Pas de `gsap.to` dans pointermove — utiliser `gsap.set` ou quickSetter

### UI polish SwipeCard

**Overlay** :
- Icône : 48px, font-weight 900, `text-shadow: 0 2px 8px rgba(0,0,0,0.3)`
- Label : `letter-spacing: 0.1em`, uppercase, 12px
- Transition couleur overlay : `rgba` interpolé en continu (déjà fait via opacity)

**Action buttons** :
- Postuler : `background: var(--accent)` + `box-shadow: 0 2px 8px rgba(99,102,241,0.3)` au hover
- Sauver : `border-color: rgba(251,191,36,0.4)`, hover `color: #f59e0b`
- Ignorer : hover `background: #fef2f2`, `color: #f87171`

**Source badge** — couleur par source :
- `jsearch` → indigo (`bg-indigo-50 text-indigo-600 border-indigo-200`)
- `france_travail` → blue (`bg-blue-50 text-blue-600 border-blue-200`)
- `hellowork` → emerald (`bg-emerald-50 text-emerald-600 border-emerald-200`)
- `email` → amber (`bg-amber-50 text-amber-600 border-amber-200`)
- fallback → zinc

### UI polish Search page

- Profile card : `hover:shadow-md transition-shadow duration-200`
- Badge Actif : `bg-green-50 border border-green-200 text-green-700` (harmonisé avec le reste)
- Chips `type_contrat` dans la carte de liste : même style que ProfileModal (`bg-accent-dim text-accent`)

### ProfileModal

- Exclusion preset buttons actifs : `ring-1 ring-accent` + background accent (vs background seul)
- Select durée : `<optgroup>` pour séparer visuellement semaines / mois / long terme

---

## Fichiers touchés

| Fichier | Changements |
|---------|------------|
| `components/offers/SwipeDeck.tsx` | Architecture wrapper, gsap.context, gsap.set init, animation promote |
| `components/offers/SwipeCard.tsx` | position:relative, supprime stackStyle, quickSetter drag, polish overlay+buttons+badge |
| `app/search/page.tsx` | Responsive flex-col mobile, header button mobile |
| `components/search/ProfileModal.tsx` | Grid responsive, padding, max-height, ring sur presets, optgroup |
