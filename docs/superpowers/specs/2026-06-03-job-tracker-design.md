# Job Tracker — Design Spec
**Date:** 2026-06-03  
**Auteur:** Clement Rubin  
**Statut:** Validé

---

## 1. Vue d'ensemble

Application web de suivi de recherche d'emploi. Centralise candidatures, offres à traiter, parsing emails, scraping multi-sources, et assistant vocal IA. Adaptable selon type de recherche (intérim, stage, CDI). Déployée sur Netlify, 100% gratuit.

---

## 2. Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Base de données | Supabase (PostgreSQL) |
| Auth / OAuth tokens | Supabase Auth + stockage tokens chiffré |
| Hébergement | Netlify (fonctions + cron) |
| Email | Gmail API (OAuth 2.0) + Microsoft Graph (OAuth 2.0) |
| Scraping offres | JSearch RapidAPI + APEC API + HelloWork (Cheerio) + France Travail API |
| STT voix | Web Speech API (natif navigateur) |
| IA assistant | Groq API — Llama 3.3 70B (clé utilisateur) |

---

## 3. Modèle de données (Supabase)

### `applications`
```sql
id uuid PK
user_id uuid FK
entreprise text NOT NULL
poste text NOT NULL
lien_offre text
statut enum('en_cours', 'termine', 'relance') DEFAULT 'en_cours'
resultat enum('accepte', 'refus', 'sans_reponse') NULLABLE
type_contrat enum('interim', 'stage', 'cdi', 'cdd', 'alternance')
date_postulation date
notes text
source text  -- 'manual' | 'email' | 'jsearch' | etc.
created_at timestamptz
updated_at timestamptz
```

### `offers`
```sql
id uuid PK
user_id uuid FK
titre text NOT NULL
entreprise text
lien text
salaire_min int NULLABLE
salaire_max int NULLABLE
localisation text
source text  -- 'jsearch' | 'apec' | 'hellowork' | 'france_travail' | 'email'
type_contrat text
statut enum('non_traite', 'ignore', 'postule', 'sauvegarde') DEFAULT 'non_traite'
date_scraped timestamptz
raw_data jsonb  -- données source brutes
```

### `email_imports`
```sql
id uuid PK
user_id uuid FK
provider enum('gmail', 'outlook')
email_id text UNIQUE  -- ID natif Gmail/Outlook (déduplication)
expediteur text
sujet text
date_reception timestamptz
type_detecte enum('offre', 'reponse', 'relance', 'autre')
application_id uuid FK NULLABLE  -- lié si réponse à candidature
offer_id uuid FK NULLABLE  -- lié si offre importée
parsed_data jsonb
traite boolean DEFAULT false
```

### `search_profiles`
```sql
id uuid PK
user_id uuid FK
nom text  -- ex: "Intérim Lille Juillet 2026"
actif boolean DEFAULT false
type_contrat text[]
mots_cles text[]
localisation text
rayon_km int DEFAULT 30
salaire_min int NULLABLE
created_at timestamptz
```

### `oauth_tokens`
```sql
id uuid PK
user_id uuid FK
provider enum('gmail', 'outlook')
access_token text  -- chiffré
refresh_token text  -- chiffré
expires_at timestamptz
scopes text[]
```

### `assistant_logs`
```sql
id uuid PK
user_id uuid FK
transcription text
intent text
action_taken text
success boolean
created_at timestamptz
```

---

## 4. Pages & Navigation

```
[Dashboard] [Candidatures] [Offres à traiter] [Recherche] [Paramètres]
```

### Dashboard (`/`)
- Stats synthèse : total postulées, en cours, relances, refus/acceptés
- Timeline activité récente (dernières 7 entrées)
- Actions rapides : "Ajouter candidature", "Voir offres non traitées"
- Bouton micro assistant toujours visible

### Candidatures (`/applications`)
- Tableau filtrable : statut, type contrat, date, entreprise
- Vue Kanban optionnelle (toggle) : colonnes par statut, drag & drop
- Badge couleur statut
- Click ligne → fiche détail : historique, emails liés, notes éditables
- Bouton "Ajouter manuellement" + ajout rapide via assistant

### Offres à traiter (`/offers`)
- Feed de cartes : offres non traitées en premier
- Filtres : source, type contrat, salaire, localisation
- Actions par carte : Postuler / Ignorer / Sauvegarder
- Postuler → crée automatiquement une entrée `applications`
- Badge source (JSearch / APEC / HelloWork / France Travail / Email)

### Recherche (`/search`)
- Gestion profils de recherche (CRUD)
- Lancer recherche manuelle avec profil actif
- Aperçu résultats avant import dans Offres
- Toggle profil actif (intérim vs stage)

### Paramètres (`/settings`)
- Connexion/déconnexion Gmail + Outlook (OAuth)
- Clé Groq API (saisie + test)
- Profil utilisateur (nom, email de référence)
- Préférences : thème clair/sombre, fréquence sync emails

---

## 5. API Routes (Next.js)

### Auth OAuth
```
GET  /api/auth/gmail/connect     → redirect vers Google OAuth
GET  /api/auth/gmail/callback    → échange code → tokens → Supabase
GET  /api/auth/outlook/connect   → redirect vers Microsoft OAuth
GET  /api/auth/outlook/callback  → échange code → tokens → Supabase
DELETE /api/auth/[provider]      → révoque et supprime tokens
```

### Emails
```
POST /api/emails/sync            → parse nouveaux emails (Gmail + Outlook)
GET  /api/emails/imports         → liste email_imports paginée
```

### Jobs / Offres
```
POST /api/jobs/fetch             → scrape toutes sources avec profil actif
GET  /api/offers                 → liste offres paginée + filtres
PATCH /api/offers/[id]           → update statut
```

### Candidatures
```
GET    /api/applications         → liste + filtres
POST   /api/applications         → créer
PATCH  /api/applications/[id]    → update (statut, notes, etc.)
DELETE /api/applications/[id]    → supprimer
```

### Assistant
```
POST /api/assistant/process
  body: { transcription: string, context: { page, recent_applications[] } }
  response: { intent: string, action: object, message: string, updates: object[] }
```

---

## 6. Netlify Scheduled Functions (Cron)

| Fonction | Schedule | Action |
|----------|----------|--------|
| `sync-emails` | `0 8,20 * * *` | Sync Gmail + Outlook → parse → `email_imports` + `offers` |
| `fetch-jobs` | `0 7 * * 1-5` | JSearch + APEC + HelloWork + France Travail → `offers` |

---

## 7. Scraping multi-sources

### JSearch RapidAPI
- Endpoint existant : `jsearch.p.rapidapi.com/search`
- Paramètres : query depuis `search_profiles.mots_cles`, `country=fr`, location
- Clé existante dans secrets

### APEC
- API non-officielle : `https://www.apec.fr/cms/webservices/rechercheOffre/rechercherOffre`
- Headers standards navigateur, JSON response
- Filtres : typeContrat, lieuTravail, nombreMois (intérim)

### HelloWork
- Scraping HTML via Cheerio : `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=<query>&l=<location>`
- Extraire : titre, entreprise, lien, contrat, salaire si présent

### France Travail (Pôle Emploi)
- API officielle : `https://api.emploi-store.fr/partenaire/offresdemploi/v2/offres/search`
- OAuth client_credentials avec clés API France Travail (gratuites, inscription requise)
- Filtres : typeContrat, commune, distance, motsCles

---

## 8. Assistant vocal "Alex"

### Personnalité
Coach RH professionnel et efficace. Ton direct, bienveillant, orienté action. Pas de bavardage superflu.

### Interface
- Bulle flottante bas-droite, toutes pages
- Click → activation micro (Web Speech API)
- Animation pulse pendant écoute
- Feedback toast : action effectuée ou demande de confirmation si ambiguë

### Prompt système Groq
```
Tu es Alex, assistant RH professionnel. Tu aides l'utilisateur à gérer sa recherche d'emploi.
Tu reçois une transcription vocale + contexte (page actuelle, candidatures récentes).
Tu retournes UNIQUEMENT un JSON avec :
{
  "intent": string,           // "update_application" | "add_application" | "add_note" | "query" | "unknown"
  "confidence": number,       // 0-1
  "action": object,           // données pour l'action
  "message": string,          // réponse courte à afficher à l'utilisateur (1-2 phrases)
  "requires_confirmation": boolean
}

Intents supportés :
- update_application : modifier statut/notes d'une candidature existante
- add_application : créer nouvelle candidature
- add_note : ajouter note à candidature
- query : question sur les candidatures (stats, liste)
- unknown : intention non comprise

Pour update_application, cherche la correspondance dans le contexte fourni.
```

### Exemples d'intentions
| Phrase | Intent | Action |
|--------|--------|--------|
| "J'ai eu un entretien chez Decathlon hier" | update_application | statut → en_cours, note "entretien le 02/06" |
| "Decathlon m'a refusé" | update_application | statut → terminé, résultat → refus |
| "J'attends toujours une réponse de Leroy Merlin" | update_application | statut → relance |
| "Combien de candidatures j'ai envoyé ce mois ?" | query | réponse textuelle |
| "J'ai postulé chez Amazon pour du magasin" | add_application | créer entrée |

---

## 9. Parsing emails

### Détection type
Groq (modèle léger) analyse sujet + extrait corps email :
- **Offre entrante** : mots-clés "opportunité", "offre d'emploi", "nous recrutons", liens offres
- **Réponse positive** : "entretien", "nous souhaitons vous rencontrer", "candidature retenue"
- **Refus** : "nous avons le regret", "candidature n'a pas été retenue", "ne donnera pas suite"
- **Relance nécessaire** : email sans réponse > 7 jours

### Matching candidature
Si email de type `réponse` :
1. Extraire nom entreprise depuis expéditeur/corps
2. Chercher dans `applications` : match sur `entreprise` (fuzzy)
3. Si match trouvé → lier `email_imports.application_id`
4. Si aucun match → créer `offers` avec statut `non_traite`

---

## 10. Adaptabilité type de recherche

Le `search_profiles.type_contrat` conditionne :
- Labels UI ("intérim 1 mois" vs "stage 6 mois" vs "CDI")
- Paramètres API scraping (durée contrat, mots-clés ajoutés automatiquement)
- Filtres email parsing
- Aucun code conditionnel lourd — tout piloté par données

---

## 11. Design UI

### Palette (dark par défaut)
```
Background:  #0F1117
Cards:       #1A1D27
Border:      #2D3148
Accent:      #6366F1  (indigo)
Success:     #10B981
Warning:     #F59E0B
Danger:      #EF4444
Text:        #F8FAFC
Text-muted:  #94A3B8
```

### Badges statut candidatures
- `en_cours` → indigo
- `relance` → amber
- `terminé/accepté` → vert
- `terminé/refus` → rouge

### Responsive
Desktop-first. Mobile : navigation bottom bar, tableaux scrollables horizontalement.

---

## 12. Sécurité

- Tokens OAuth chiffrés dans Supabase (AES-256 via `pgsodium`)
- RLS (Row Level Security) Supabase : chaque user voit uniquement ses données
- Clé Groq stockée côté client (localStorage) — jamais envoyée au backend sauf dans header Authorization
- Variables d'environnement Netlify pour clés JSearch, France Travail OAuth
- Rate limiting sur `/api/jobs/fetch` (1 appel/10min max)

---

## 13. Variables d'environnement requises

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gmail OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Microsoft OAuth
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=

# Job APIs
RAPIDAPI_KEY=<your_rapidapi_key>
FRANCE_TRAVAIL_CLIENT_ID=
FRANCE_TRAVAIL_CLIENT_SECRET=

# App
NEXT_PUBLIC_APP_URL=
NEXTAUTH_SECRET=
```

---

## 14. Hors scope (v1)

- Multi-utilisateurs
- Export PDF/Excel des candidatures
- Notifications push mobile
- Intégration LinkedIn direct (scraping bloqué)
- Analyse IA des offres (matching CV)
