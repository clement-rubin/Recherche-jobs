# Design — Wizard étape par étape pour la création/édition de profil de recherche

Date : 2026-08-25

## Contexte / problème

Le formulaire actuel de création de profil de recherche (`components/search/ProfileModal.tsx`) est un formulaire monolithique à écran unique. Il pose plusieurs problèmes :

1. **Pas de garde-fou** entre les mots-clés à inclure (`mots_cles`) et à exclure (`mots_cles_exclus`) : rien n'empêche d'ajouter le même mot dans les deux listes, ce qui produit un comportement de recherche incohérent.
2. **Suggestions de mots-clés non pertinentes** : `KW_SUGGESTIONS` et `QUAL_SUGGESTIONS` sont codées en dur pour un profil logistique/entrepôt (`magasinier`, `cariste`, `CACES 3`...), alors que l'usage réel actuel est la recherche d'emploi Data/IA. Il n'existe aucun champ "domaine" pour adapter ces suggestions.
3. **Une seule ville par profil** : `localisation` est une string unique + `rayon_km` unique, impossible de rechercher sur plusieurs villes avec des rayons différents dans un seul profil.
4. **Formulaire dense**, tous les champs sur un seul écran scrollable — l'utilisateur doit penser à tout en même temps (mots-clés, exclusions, qualifications, contrat...) sans guidage.

Le backend (scraping, dédup, filtrage par mots-clés exclus) garde la même logique — c'est uniquement l'expérience de saisie et le modèle de données villes/domaine qui évoluent.

## Schéma DB

```sql
ALTER TABLE search_profiles
  ADD COLUMN IF NOT EXISTS domaine text,
  ADD COLUMN IF NOT EXISTS localisations jsonb DEFAULT '[]';
```

Migration des données existantes (avant le DROP) :

```sql
UPDATE search_profiles
SET localisations = jsonb_build_array(jsonb_build_object('ville', localisation, 'rayon_km', rayon_km))
WHERE localisation IS NOT NULL;
```

Puis suppression des anciennes colonnes :

```sql
ALTER TABLE search_profiles DROP COLUMN localisation, DROP COLUMN rayon_km;
```

`localisations` : `[{ ville: string, rayon_km: number }]`, minimum 1 entrée.

`domaine` : string libre — soit une clé du set prédéfini ci-dessous, soit texte libre saisi par l'utilisateur si "Autre" est sélectionné.

### `lib/supabase/types.ts`

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

`localisation` et `rayon_km` disparaissent du type.

## Domaines prédéfinis

Set "tech large" :

- Data / IA
- Développement logiciel
- DevOps / Cloud
- Cybersécurité
- Product / Design
- Réseaux / Infra
- Support IT
- Autre (texte libre, aucune suggestion associée)

### `components/search/domainSuggestions.ts`

```ts
export interface DomainSuggestions {
  motsCles: string[]
  exclusions: string[]
  qualifications: string[]
}

export const DOMAIN_SUGGESTIONS: Record<string, DomainSuggestions> = {
  data_ia: {
    motsCles: ['data scientist', 'data analyst', 'machine learning', 'data engineer', 'MLOps', 'data'],
    exclusions: ['stage', 'junior', '5 ans d\'expérience', 'senior', 'thèse'],
    qualifications: ['AWS', 'Azure', 'GCP', 'TensorFlow', 'PyTorch', 'SQL', 'Bac+5'],
  },
  dev_logiciel: { motsCles: [...], exclusions: [...], qualifications: [...] },
  devops_cloud: { motsCles: [...], exclusions: [...], qualifications: [...] },
  cybersecurite: { motsCles: [...], exclusions: [...], qualifications: [...] },
  product_design: { motsCles: [...], exclusions: [...], qualifications: [...] },
  reseaux_infra: { motsCles: [...], exclusions: [...], qualifications: [...] },
  support_it: { motsCles: [...], exclusions: [...], qualifications: [...] },
}
```

(Contenu exact des listes à finaliser en implémentation — le principe est validé, pas le wording précis de chaque suggestion.)

## Architecture composants

```
components/search/
  WizardModal.tsx           # orchestrateur : state global, navigation, validation, onSave
  domainSuggestions.ts       # mapping domaine -> suggestions
  steps/
    StepIdentite.tsx         # nom + domaine (select + "autre" texte libre)
    StepVilles.tsx           # liste villes+rayon, add/remove ligne
    StepMotsClesInclus.tsx   # TagInput + suggestions domaine
    StepMotsClesExclus.tsx   # TagInput + presets contrat + suggestions domaine + blocage doublon
    StepQualifications.tsx   # TagInput + suggestions domaine
    StepContrat.tsx          # type contrat + durée + salaire min
```

`ProfileModal.tsx` est supprimé, remplacé par `WizardModal.tsx` dans `app/search/page.tsx` (création ET édition — même composant, pré-rempli en édition, navigation libre entre étapes déjà visitées via une barre de progression cliquable).

`WizardModal` porte le `form` state complet (shape proche de `Partial<SearchProfile>`), le `currentStep`, et transmet `value`/`onChange` scoped à chaque step. `TagInput` et `AsyncButton` existants réutilisés tels quels.

## Détail des 6 étapes

**1. Identité** — Nom du profil (texte, requis) + Domaine (`<select>` des 7 domaines + "Autre" ; si "Autre", champ texte libre apparaît).

**2. Villes** — Liste de lignes `{ville, rayon_km}`, bouton "+ Ajouter une ville", ✕ par ligne, minimum 1 ville requise pour avancer.

**3. Mots-clés à inclure** — `TagInput` existant, `suggestions = DOMAIN_SUGGESTIONS[domaine].motsCles`.

**4. Mots-clés à exclure** — `TagInput` + `EXCLUSION_PRESETS` (contrat, existant) + `DOMAIN_SUGGESTIONS[domaine].exclusions`. **Blocage doublon** : refus d'ajout si le mot existe déjà dans `mots_cles` (étape 3), message inline explicite. Vérification symétrique si l'utilisateur revient à l'étape 3 après avoir rempli l'étape 4.

**5. Qualifications** — `TagInput` + `DOMAIN_SUGGESTIONS[domaine].qualifications`.

**6. Contrat** — Type contrat (toggle, existant), Durée (select groupé, existant), Salaire min (existant). Bouton "Enregistrer" ici, pas de "Suivant".

Barre de progression en haut, 6 points cliquables une fois visités (permet retour arrière et navigation directe en édition). "Suivant" désactivé tant que le champ requis de l'étape courante n'est pas rempli (nom étape 1, ≥1 ville étape 2).

## Backend — `app/api/jobs/fetch/route.ts`

Logique de scraping/filtrage inchangée. Ajout d'une boucle par ville, imbriquée autour de la boucle existante par mot-clé :

```
pour chaque search_profile actif :
  pour chaque {ville, rayon_km} dans localisations :
    pour chaque mot_cle dans mots_cles :
      appelle les 4 scrapers en parallèle (ville, rayon_km, mot_cle)
déduplique par lien URL (inchangé)
filtre par mots_cles_exclus (inchangé)
```

Aucun changement dans `lib/scrapers/*.ts` — signature inchangée (`localisation`, `rayon_km` en paramètres), juste appelés plus de fois.

**Risque identifié** : nombre d'appels API = villes × mots-clés × sources. Avec plusieurs villes et plusieurs mots-clés, le volume d'appels grimpe vite — surveiller les quotas RapidAPI (JSearch) et France Travail si un profil combine beaucoup de villes et de mots-clés.

## Affichage liste profils — `app/search/page.tsx`

Carte profil : remplace `{profile.localisation} · {profile.rayon_km}km` par :
- Badge domaine (si renseigné) à côté du nom du profil
- Liste des villes : `Lille (30km), Roubaix (10km)` (join des `localisations`)

## Tests

- Navigation étape par étape du `WizardModal` : bouton "Suivant" désactivé si champ requis manquant, activé sinon.
- Blocage doublon mot-clé inclure/exclure, dans les deux sens.
- Ajout/suppression de ligne ville dans `StepVilles`, validation minimum 1 ville.
- `route.ts` fetch : la boucle multi-villes appelle les scrapers le bon nombre de fois (mock scrapers, assertion `toHaveBeenCalledTimes`).

## Hors périmètre

- Pas de génération de suggestions par IA (set fixe de domaines, décidé explicitement contre l'option LLM).
- Pas de changement de thème visuel (zinc/accent existant conservé).
- Pas de nouvelle dépendance npm.
