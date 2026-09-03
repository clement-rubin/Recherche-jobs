# RAPPORT D'AUDIT SÉCURITÉ APPLICATIF

**Projet** : JobTrackeria  
**Date d'audit** : 2026-06-05  
**Auditeur** : Claude Sonnet 4.6 — Anthropic (méthodologie OWASP ASVS 4.0)  
**Version** : 2.0  
**Confidentialité** : CONFIDENTIEL — usage interne uniquement

---

## SCORE GLOBAL : 78/100 — GÉRÉ (Niveau 4)

> JobTrackeria présente une posture de sécurité **Gérée** (75-89) avec de bonnes pratiques de base bien établies, mais plusieurs faiblesses notables dans la configuration, la gestion des secrets et la surface d'attaque exposée en production.

---

## EXECUTIVE SUMMARY

Le projet JobTrackeria (Next.js 16 App Router + Supabase + Netlify) a été audité selon OWASP ASVS 4.0, NIST SP 800-53, et SANS/CWE Top 25. L'analyse couvre 55 fichiers source TypeScript/TSX, 10 endpoints API, 4 scrapers externes, et 1 pipeline cron.

Points clés :
- **0 vulnérabilité critique** — pas de secrets hardcodés dans le code source, pas de SQLi, pas de RCE
- **5 vulnérabilités HIGH** requièrent une action sous 30 jours (CSP unsafe-eval, page de diagnostic en production, fichiers sensibles dans git, misconfiguration env)
- **10 vulnérabilités MEDIUM** à traiter dans le mois suivant
- Score le plus faible : **Section 8 — Secrets & Configuration** (62/100)
- Score le plus élevé : **Sections 3 & 7 — Contrôle d'accès & Dépendances** (90/100)
- Le contrôle d'accès par `user_id` est correctement appliqué sur tous les endpoints

---

## TABLEAU DE BORD DES SCORES

| Section | Score | Niveau | Findings |
|---------|-------|--------|---------|
| 1. Structure & Arborescence | 68/100 | 🟡 | C:0 H:1 M:1 L:1 |
| 2. Authentification & Sessions | 82/100 | 🟢 | C:0 H:0 M:1 L:0 |
| 3. Contrôle d'accès | 90/100 | ⭐ | C:0 H:0 M:0 L:1 |
| 4. Injections & Validation | 82/100 | 🟢 | C:0 H:0 M:1 L:2 |
| 5. Cryptographie | 75/100 | 🟢 | C:0 H:0 M:2 L:1 |
| 6. Gestion erreurs & Logs | 80/100 | 🟢 | C:0 H:0 M:0 L:3 |
| 7. Dépendances & Supply Chain | 90/100 | ⭐ | C:0 H:0 M:0 L:0 |
| 8. Secrets & Configuration | 62/100 | 🟡 | C:0 H:2 M:2 L:0 |
| 9. Architecture & Design | 78/100 | 🟢 | C:0 H:1 M:1 L:0 |
| 10. API & Communication | 70/100 | 🟡 | C:0 H:1 M:2 L:1 |
| **SCORE GLOBAL** | **78/100** | **🟢 GÉRÉ** | **C:0 H:5 M:10 L:9** |

Légende : 🔴 < 40 \| 🟠 40-59 \| 🟡 60-74 \| 🟢 75-89 \| ⭐ 90+

---

## DÉTAIL DES SECTIONS

---

### Section 1 — Structure & Arborescence
**Score : 68/100** | Poids : 8% | Contribution au score global : 5.44 pts

#### Résumé
La structure Next.js App Router est propre et bien organisée (`app/`, `lib/`, `components/`). Les scrapers sont isolés dans `lib/scrapers/`. Le `.gitignore` est complet. Cependant, un fichier de log (`logs.zip`) a été commis dans l'historique git, et des scripts de pentest ne devraient pas rester dans le repo de production.

#### Findings

##### 🟠 [HIGH] — Fichier logs.zip commis dans git
- **Fichier(s)** : `logs.zip` (commit `7d47129 JobTracker`)
- **Description** : Un fichier d'archive de logs a été commis dans l'historique git. Selon son contenu, il peut exposer des adresses e-mail, des IDs utilisateur, des réponses API externes, ou des stack traces.
- **Preuve** : `git log --all --oneline -- logs.zip` → `7d47129 JobTracker`
- **Référentiel** : CWE-312 (Cleartext Storage of Sensitive Information), OWASP ASVS §8.3.4
- **CVSS Score** : 6.5 (AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N)
- **Recommandation** : Supprimer le fichier de l'historique git (`git filter-repo` ou BFG Repo-Cleaner). Ajouter `logs.zip` et `*.zip` au `.gitignore`.
- **Effort de remédiation** : Moyen (1-2h)

##### 🟡 [MEDIUM] — Scripts de pentest dans le repo
- **Fichier(s)** : [`scripts/pentest-local.ps1`](scripts/pentest-local.ps1), [`scripts/pentest-local.sh`](scripts/pentest-local.sh)
- **Description** : Des scripts de test d'intrusion sont commis dans le repo. Ils révèlent la surface d'attaque et les points de test aux personnes ayant accès au repo.
- **Référentiel** : OWASP ASVS §1.14 (Secure Development Lifecycle)
- **Recommandation** : Déplacer dans un repo privé séparé ou gitignorer.
- **Effort de remédiation** : Faible (30min)

##### 🟢 [LOW] — `security-audit-report.md` dans l'historique git
- **Fichier(s)** : `security-audit-report.md` (commit `445dccd`)
- **Description** : Le rapport d'audit précédent est versionné. Si le repo est rendu public, il expose les findings de sécurité internes.
- **Recommandation** : Ajouter `security-audit-report*.md` au `.gitignore` ou déplacer les rapports hors du repo.
- **Effort de remédiation** : Faible (15min)

#### Points positifs
- ✅ Structure App Router claire : séparation `app/`, `lib/`, `components/`
- ✅ `.gitignore` complet (`.env*`, `*.pem`, `node_modules`, `/zap-reports/`)
- ✅ `.env.local.example` présent avec valeurs placeholders uniquement
- ✅ Suite de tests dans `__tests__/`

---

### Section 2 — Authentification & Sessions
**Score : 82/100** | Poids : 15% | Contribution au score global : 12.3 pts

#### Résumé
L'authentification Supabase est correctement implémentée. Le middleware protège toutes les routes non-API, et chaque route API vérifie `supabase.auth.getUser()`. Le flux OAuth Gmail implémente correctement un state CSRF avec `randomBytes(32)`.

#### Findings

##### 🟡 [MEDIUM] — Cron bypass sans isolation utilisateur documentée
- **Fichier(s)** : [`app/api/emails/sync/route.ts:7-12`](app/api/emails/sync/route.ts)
- **Description** : L'endpoint `POST /api/emails/sync` accepte le `CRON_SECRET` Bearer token sans session utilisateur. Dans ce cas, il accède aux tokens OAuth de **tous** les utilisateurs sans distinction. Le mécanisme est correct (conçu pour le cron), mais si le `CRON_SECRET` est compromis, l'attaquant peut déclencher la synchronisation de tous les comptes.
- **Preuve** :
  ```typescript
  const authorized = user || isAuthorized(req)
  // Si cron (pas de user) : fetch ALL gmail tokens
  tokensResult = await db.from('oauth_tokens').select('*').eq('provider', 'gmail')
  ```
- **Référentiel** : OWASP ASVS §4.2.1 (Access Control)
- **Recommandation** : Renforcer la sécurité du `CRON_SECRET` (rotation périodique). Documenter explicitement le comportement multi-tenant du cron.
- **Effort de remédiation** : Faible (documentation + secret rotation)

#### Points positifs
- ✅ `supabase.auth.getUser()` sur chaque route API protégée
- ✅ Middleware `matcher` exclut correctement `api/` et `_next/`
- ✅ CSRF OAuth : `randomBytes(32)` → cookie `httpOnly`, `secure`, `sameSite: lax`, TTL 10min
- ✅ Cookies de session gérés par Supabase (secure by default)
- ✅ Pas de secrets de session hardcodés dans le code

---

### Section 3 — Contrôle d'accès
**Score : 90/100** | Poids : 10% | Contribution au score global : 9.0 pts

#### Résumé
Contrôle d'accès exemplaire. Toutes les routes API scindent les données par `user_id` via `.eq('user_id', user.id)`. Aucune faille IDOR identifiée. La whitelist de champs (`allowed`) dans POST/PATCH prévient le mass assignment.

#### Findings

##### 🟢 [LOW] — Page `/test` accessible à tout utilisateur authentifié
- **Fichier(s)** : [`app/test/page.tsx`](app/test/page.tsx)
- **Description** : La page de diagnostic est protégée uniquement par l'authentification (middleware), sans vérification de rôle admin. Tout utilisateur connecté peut déclencher des opérations intensives (scraping complet, sync email, CRUD).
- **Référentiel** : OWASP ASVS §4.1.3 (Principle of Least Privilege)
- **Recommandation** : Voir Section 9 pour la remédiation complète de cette page.
- **Effort de remédiation** : Moyen

#### Points positifs
- ✅ Toutes requêtes Supabase filtrent par `.eq('user_id', user.id)` → pas d'IDOR
- ✅ Whitelist explicite des champs acceptés dans POST/PATCH (mass assignment prévenu)
- ✅ `PATCH /api/offers/[id]` n'autorise que `statut`, refuse `raw_data`/`titre`
- ✅ Applications `[id]/route.ts` scope DELETE/PATCH/GET par `user_id`

---

### Section 4 — Validation des entrées / Injections
**Score : 82/100** | Poids : 15% | Contribution au score global : 12.3 pts

#### Résumé
Aucune injection SQL directe — toutes les requêtes passent par le SDK Supabase (paramétrisé). React JSX protège contre le XSS par défaut. Aucun `eval()`, `dangerouslySetInnerHTML`, ou `child_process` détecté.

#### Findings

##### 🟡 [MEDIUM] — Absence de validation des valeurs retournées par le LLM
- **Fichier(s)** : [`app/api/assistant/process/route.ts:73-74`](app/api/assistant/process/route.ts)
- **Description** : Les valeurs `action.statut` et `action.resultat` issues du modèle Groq (LLM) sont écrites directement en base sans validation contre un enum autorisé. Si le LLM hallucine une valeur hors-enum, elle peut corrompre les données.
- **Preuve** :
  ```typescript
  if (action.statut) update.statut = action.statut   // pas de validation enum
  if (action.resultat) update.resultat = action.resultat  // pas de validation enum
  ```
- **Référentiel** : OWASP ASVS §5.1.3 (Input Validation), CWE-20
- **CVSS Score** : 4.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N)
- **Recommandation** :
  ```typescript
  const VALID_STATUTS = ['en_cours', 'relance', 'termine'] as const
  const VALID_RESULTATS = ['accepte', 'refus'] as const
  if (action.statut && VALID_STATUTS.includes(action.statut as any)) update.statut = action.statut
  if (action.resultat && VALID_RESULTATS.includes(action.resultat as any)) update.resultat = action.resultat
  ```
- **Effort de remédiation** : Faible (1h)

##### 🟢 [LOW] — Transcription non bornée en longueur
- **Fichier(s)** : [`app/api/assistant/process/route.ts:16`](app/api/assistant/process/route.ts)
- **Description** : La transcription envoyée à Groq n'a pas de limite de longueur. Un utilisateur peut envoyer une chaîne très longue (prompt injection, surcoût API).
- **Recommandation** : `if (transcription.length > 1000) return NextResponse.json({ error: 'Trop long' }, { status: 400 })`
- **Effort de remédiation** : Faible (15min)

##### 🟢 [LOW] — Pattern LIKE depuis parsing IA (ilike sur entreprise)
- **Fichier(s)** : [`app/api/emails/sync/route.ts:138`](app/api/emails/sync/route.ts)
- **Description** : `.ilike('entreprise', \`%${parsed.entreprise}%\`)` — la valeur vient du parseur IA. Le SDK Supabase paramétrise la requête, donc pas d'injection SQL. Les wildcards LIKE peuvent cependant causer des matches non désirés.
- **Référentiel** : CWE-89 (partiellement mitigé par ORM)
- **Recommandation** : Escape optionnel des wildcards LIKE pour plus de précision.
- **Effort de remédiation** : Faible

#### Points positifs
- ✅ SDK Supabase utilisé partout → requêtes paramétrisées, pas de SQLi
- ✅ Aucun `eval()`, `dangerouslySetInnerHTML`, `child_process` détecté
- ✅ React JSX escaping automatique → XSS prévenu
- ✅ URLs HelloWork/FT construites avec `encodeURIComponent` → pas de SSRF
- ✅ Domaines de destination hardcodés dans les scrapers

---

### Section 5 — Cryptographie
**Score : 75/100** | Poids : 10% | Contribution au score global : 7.5 pts

#### Résumé
Aucun algorithme cryptographique cassé détecté. Les secrets CSRF utilisent `randomBytes(32)`. La gestion TLS est déléguée à Netlify (HTTPS automatique). Principal problème : les tokens OAuth sont stockés en clair dans la base de données.

#### Findings

##### 🟡 [MEDIUM] — Tokens OAuth stockés en plaintext dans Supabase
- **Fichier(s)** : [`app/api/auth/gmail/callback/route.ts:48-57`](app/api/auth/gmail/callback/route.ts)
- **Description** : Les `access_token` et `refresh_token` Google sont insérés en clair dans la table `oauth_tokens`. En cas de breach de la base Supabase, tous les tokens OAuth sont compromis.
- **Référentiel** : OWASP ASVS §2.10.1, CWE-312 (Cleartext Storage of Sensitive Information)
- **CVSS Score** : 6.8 (AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N)
- **Recommandation** : Utiliser Supabase Vault pour la table `oauth_tokens`, ou chiffrer les tokens avec AES-256-GCM avant insertion. Vérifier que RLS est activé sur `oauth_tokens`.
- **Effort de remédiation** : Élevé (refactoring + migration)

##### 🟡 [MEDIUM] — Header HSTS absent
- **Fichier(s)** : [`next.config.ts`](next.config.ts)
- **Description** : `Strict-Transport-Security` n'est pas configuré dans les headers Next.js. Netlify peut l'ajouter automatiquement, mais une configuration explicite est recommandée.
- **Référentiel** : OWASP ASVS §9.1.1, CWE-319
- **Recommandation** : Ajouter dans `next.config.ts` : `{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }`
- **Effort de remédiation** : Faible (15min)

##### 🟢 [LOW] — Variables Supabase misconfigurées dans `.env.local`
- **Fichier(s)** : `.env.local` (fichier local, non commis)
- **Description** : `NEXT_PUBLIC_SUPABASE_URL` contient le path `/rest/v1/` en suffixe (doit être l'URL racine), et `NEXT_PUBLIC_SUPABASE_ANON_KEY` a un caractère surnuméraire en préfixe (doit commencer par `eyJ`).
- **Recommandation** : Corriger les valeurs depuis le dashboard Supabase > Settings > API.
- **Effort de remédiation** : Faible (5min)

#### Points positifs
- ✅ `randomBytes(32)` pour le state CSRF OAuth (entropie cryptographique correcte)
- ✅ Cookie CSRF : `httpOnly: true`, `secure: true` (production), `sameSite: lax`
- ✅ Aucun algorithme cassé (MD5, SHA1, DES, RC4) dans le code
- ✅ TLS délégué à Netlify (certificat automatique Let's Encrypt)

---

### Section 6 — Gestion des erreurs & Logs
**Score : 80/100** | Poids : 7% | Contribution au score global : 5.6 pts

#### Résumé
Les messages d'erreur retournés aux clients sont génériques. Les stack traces ne sont pas exposées. Les routes API retournent des codes HTTP appropriés. Problème mineur : des données potentiellement sensibles apparaissent dans les logs serveur.

#### Findings

##### 🟢 [LOW] — Logs serveur incluent des sujets d'email
- **Fichier(s)** : [`app/api/emails/sync/route.ts:88`](app/api/emails/sync/route.ts)
- **Description** : Des sujets d'emails sont loggés dans les logs Netlify (potentiellement confidentiels).
- **Référentiel** : OWASP ASVS §7.1.1, CWE-532, GDPR Art. 5(1)(f)
- **Recommandation** : Retirer les sujets des logs ou les masquer.
- **Effort de remédiation** : Faible (5min)

##### 🟢 [LOW] — Catch blocks silencieux dans les scrapers
- **Fichier(s)** : [`lib/scrapers/france-travail.ts:38`](lib/scrapers/france-travail.ts), [`lib/scrapers/hellowork.ts:63`](lib/scrapers/hellowork.ts)
- **Description** : `catch { return [] }` avale toutes les erreurs sans log. Impossible de diagnostiquer des pannes silencieuses en production.
- **Référentiel** : CWE-390 (Detection of Error Condition Without Action)
- **Recommandation** : Ajouter `console.warn` avec le message d'erreur.
- **Effort de remédiation** : Faible (15min)

##### 🟢 [LOW] — Logs exposent les user IDs en clair
- **Fichier(s)** : [`app/api/applications/route.ts:30`](app/api/applications/route.ts) et autres routes
- **Description** : Les UUIDs Supabase des utilisateurs sont loggés. Dans un contexte RGPD, les identifiants techniques sont des données personnelles.
- **Référentiel** : GDPR Art. 5, OWASP ASVS §7.1.2
- **Recommandation** : Logger `user.id.slice(0, 8)` ou supprimer le userId des logs.
- **Effort de remédiation** : Faible (30min)

#### Points positifs
- ✅ Messages d'erreur côté client génériques (pas de stack trace exposée)
- ✅ Codes HTTP appropriés : 401/404/429/500 selon le cas
- ✅ Pas de `debug: true` ou mode verbose en production

---

### Section 7 — Dépendances & Supply Chain
**Score : 90/100** | Poids : 10% | Contribution au score global : 9.0 pts

#### Résumé
`npm audit` ne rapporte aucune vulnérabilité connue. `package-lock.json` est présent. Le commit `445dccd` mentionne explicitement le patch d'un CVE postcss. Stack moderne (Next.js 16, Supabase SSR, Tailwind v4).

#### Points positifs
- ✅ `npm audit` : 0 vulnérabilité critique ou high
- ✅ `package-lock.json` présent (versions verrouillées)
- ✅ CVE postcss déjà patché (commit `445dccd`)
- ✅ Dépendances modernes et maintenues
- ✅ Pas de dépendances abandonnées ou suspectes

---

### Section 8 — Secrets & Configuration
**Score : 62/100** | Poids : 10% | Contribution au score global : 6.2 pts

#### Résumé
Aucun secret API n'est hardcodé dans le code source. Le `.gitignore` exclut correctement `.env*`. Cependant, deux erreurs de configuration dans `.env.local` peuvent provoquer des pannes d'auth, et la configuration `netlify.toml` contient une exemption de scan de secrets trop permissive.

#### Findings

##### 🟠 [HIGH] — `SECRETS_SCAN_OMIT_KEYS` trop permissif dans `netlify.toml`
- **Fichier(s)** : [`netlify.toml:15`](netlify.toml)
- **Description** : La liste exempte `MICROSOFT_CLIENT_SECRET` du scan de secrets Netlify. C'est un secret réel qui devrait être scanné.
- **Preuve** :
  ```toml
  SECRETS_SCAN_OMIT_KEYS = "MICROSOFT_CLIENT_ID,MICROSOFT_CLIENT_SECRET,..."
  ```
- **Référentiel** : NIST SP 800-53 CM-7, OWASP ASVS §14.2.3
- **Recommandation** : Retirer `MICROSOFT_CLIENT_SECRET` de la liste d'exemption. Garder uniquement les variables réellement publiques (`NEXT_PUBLIC_*`, redirect URIs).
- **Effort de remédiation** : Faible (15min)

##### 🟠 [HIGH] — Misconfiguration des variables Supabase dans `.env.local`
- **Fichier(s)** : `.env.local` (local uniquement, non commis)
- **Description** : Deux erreurs de configuration détectées :
  1. `NEXT_PUBLIC_SUPABASE_URL` contient le path `/rest/v1/` en suffixe incorrect
  2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` commence par un caractère surnuméraire
  Ces erreurs peuvent provoquer des échecs d'authentification non-diagnostiqués.
- **Référentiel** : OWASP ASVS §14.2.2
- **Recommandation** : Corriger depuis Supabase Dashboard > Settings > API. URL correcte : `https://[ref].supabase.co`
- **Effort de remédiation** : Faible (5min)

##### 🟡 [MEDIUM] — `security-audit-report.md` versionné dans git
- **Recommandation** : Ajouter `security-audit-report*.md` au `.gitignore`.
- **Effort de remédiation** : Faible

##### 🟡 [MEDIUM] — `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local.example` non utilisée
- **Fichier(s)** : [`.env.local.example:4`](.env.local.example)
- **Description** : L'exemple documente une clé admin Supabase non utilisée dans le code. Risque si elle est ajoutée par erreur et que le code évolue.
- **Recommandation** : Retirer cette entrée de l'exemple.
- **Effort de remédiation** : Faible

#### Points positifs
- ✅ Aucun secret hardcodé dans le code source TypeScript
- ✅ `.gitignore` exclut `.env*` (sauf `.env*.example`)
- ✅ `.env.local.example` présent avec valeurs placeholder
- ✅ `CRON_SECRET` généré avec entropie suffisante (32 bytes hex)

---

### Section 9 — Architecture & Design Patterns
**Score : 78/100** | Poids : 8% | Contribution au score global : 6.24 pts

#### Résumé
Architecture Next.js App Router solide. Double vérification d'auth (middleware + route handlers). Scrapers isolés. Cron via Netlify Scheduled Functions. Principal problème : une page de diagnostic complète est accessible en production par tout utilisateur authentifié.

#### Findings

##### 🟠 [HIGH] — Page `/test` de diagnostic accessible en production
- **Fichier(s)** : [`app/test/page.tsx`](app/test/page.tsx)
- **Description** : La page `/test` est accessible à tout utilisateur authentifié. Elle permet de :
  - Déclencher le scraping complet → consomme quota RapidAPI
  - Déclencher la sync email complète
  - Créer/supprimer des applications en production
  - Afficher les quotas API et l'état des clés d'environnement
- **Référentiel** : OWASP ASVS §1.11.1, CWE-200
- **CVSS Score** : 5.4 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:L)
- **Recommandation** :
  ```typescript
  // app/test/page.tsx — vérification admin côté serveur
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',')
  if (!adminEmails.includes(user.email ?? '')) redirect('/')
  ```
- **Effort de remédiation** : Faible (1h)

##### 🟡 [MEDIUM] — Cache token France Travail en mémoire (module-level)
- **Fichier(s)** : [`lib/scrapers/france-travail.ts:3`](lib/scrapers/france-travail.ts)
- **Description** : Cache en mémoire module-level réinitialisé à chaque cold start Netlify. Pas une vulnérabilité directe, mais cause des réauthentifications inutiles.
- **Recommandation** : Stocker le token en base de données avec TTL.
- **Effort de remédiation** : Moyen (3-4h)

#### Points positifs
- ✅ Auth en double couche : middleware (redirect) + route handlers (API auth)
- ✅ Scrapers isolés dans `lib/scrapers/` avec timeout wrapper (7-15s)
- ✅ Rate limiting jobs/fetch : 2 min par utilisateur
- ✅ Cron Netlify Scheduled Functions pour jobs/fetch et emails/sync

---

### Section 10 — API & Communication
**Score : 70/100** | Poids : 7% | Contribution au score global : 4.9 pts

#### Résumé
Les headers de sécurité HTTP sont bien configurés dans `next.config.ts`. Cependant, le CSP contient `'unsafe-eval'` et `'unsafe-inline'` dans `script-src`, ce qui annule une grande partie de la protection XSS. Le header HSTS est manquant.

#### Findings

##### 🟠 [HIGH] — CSP avec `'unsafe-eval'` et `'unsafe-inline'` dans script-src
- **Fichier(s)** : [`next.config.ts:36`](next.config.ts)
- **Description** : Le Content-Security-Policy autorise `'unsafe-eval'` et `'unsafe-inline'` dans `script-src`, rendant la CSP inefficace contre les injections XSS.
- **Preuve** :
  ```typescript
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  ```
- **Référentiel** : OWASP ASVS §14.4.3, CWE-79, NIST SP 800-53 SI-10
- **CVSS Score** : 6.1 (AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N)
- **Recommandation** : Migrer vers une CSP basée sur des nonces (Next.js 13+ support nonces). Retirer `'unsafe-eval'` en priorité. Référence : [Next.js CSP with nonces](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- **Effort de remédiation** : Élevé (4-8h avec tests de régression GSAP)

##### 🟡 [MEDIUM] — HSTS non configuré explicitement
- **Recommandation** : `{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }`
- **Effort de remédiation** : Faible (15min)

##### 🟡 [MEDIUM] — COOP/COEP réglés sur `unsafe-none`
- **Fichier(s)** : [`next.config.ts:31`](next.config.ts)
- **Description** : `Cross-Origin-Opener-Policy: unsafe-none` désactive les protections Spectre. Nécessaire pour les ressources cross-origin (logos Clearbit) mais mérite documentation.
- **Recommandation** : Si possible, migrer vers `same-origin-allow-popups` pour COOP.
- **Effort de remédiation** : Moyen

##### 🟢 [LOW] — Pas de rate limiting sur `/api/assistant/process`
- **Description** : Appels Groq sans rate limit côté app. Un utilisateur malveillant peut épuiser le quota Groq.
- **Recommandation** : Rate limit basé sur `user_id` (30 req/min via compteur Supabase).
- **Effort de remédiation** : Moyen

#### Points positifs
- ✅ `X-Frame-Options: DENY` → clickjacking impossible
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `frame-ancestors 'none'` dans CSP
- ✅ `poweredByHeader: false` (cache le fingerprint Next.js)
- ✅ `Permissions-Policy` : caméra désactivée, micro limité à self

---

## PLAN DE REMÉDIATION PRIORISÉ

### Actions immédiates (0-7 jours) — HIGH

| Priorité | Finding | Fichier | Action | Effort |
|----------|---------|---------|--------|--------|
| 1 | Page `/test` en production | [`app/test/page.tsx`](app/test/page.tsx) | Ajouter vérification admin ou désactiver | 1h |
| 2 | Misconfiguration Supabase `.env.local` | `.env.local` | Corriger URL + anon key | 15min |
| 3 | `logs.zip` dans git | historique git | `git filter-repo` + `.gitignore` | 1-2h |
| 4 | `SECRETS_SCAN_OMIT_KEYS` trop large | [`netlify.toml`](netlify.toml) | Retirer `MICROSOFT_CLIENT_SECRET` | 15min |

### Court terme (8-30 jours) — HIGH/MEDIUM

| Priorité | Finding | Fichier | Action | Effort |
|----------|---------|---------|--------|--------|
| 5 | CSP `unsafe-eval`/`unsafe-inline` | [`next.config.ts`](next.config.ts) | Migrer vers nonces CSP | 4-8h |
| 6 | Validation LLM output manquante | [`app/api/assistant/process/route.ts`](app/api/assistant/process/route.ts) | Whitelist enum statut/resultat | 1h |
| 7 | HSTS manquant | [`next.config.ts`](next.config.ts) | Ajouter header HSTS | 15min |
| 8 | Subjects emails dans logs | [`app/api/emails/sync/route.ts`](app/api/emails/sync/route.ts) | Masquer/supprimer | 5min |
| 9 | Catch blocks silencieux scrapers | Scrapers | Ajouter `console.warn` | 15min |
| 10 | Scripts pentest dans repo | [`scripts/`](scripts/) | Gitignore ou repo privé | 30min |

### Moyen terme (1-3 mois) — MEDIUM/LOW

| Priorité | Finding | Fichier | Action | Effort |
|----------|---------|---------|--------|--------|
| 11 | Tokens OAuth en plaintext DB | `oauth_tokens` table | Supabase Vault ou chiffrement AES | 1-2j |
| 12 | Rate limit assistant Groq | [`app/api/assistant/process/route.ts`](app/api/assistant/process/route.ts) | Compteur par user_id | 3-4h |
| 13 | Cache FT token module-level | [`lib/scrapers/france-travail.ts`](lib/scrapers/france-travail.ts) | Stocker en DB avec TTL | 3-4h |
| 14 | User IDs dans logs | Routes API | Hasher ou tronquer | 30min |
| 15 | Transcription sans borne | [`app/api/assistant/process/route.ts`](app/api/assistant/process/route.ts) | Max length 1000 chars | 15min |

### Long terme (3-6 mois) — Architecture

| Priorité | Finding | Action |
|----------|---------|--------|
| 16 | COOP/COEP `unsafe-none` | Évaluer impact et migrer vers `same-origin-allow-popups` |
| 17 | Rotation automatique `CRON_SECRET` | Rotation trimestrielle documentée |
| 18 | Tests sécurité | Ajouter tests pour : auth bypass, IDOR, rate limiting |

---

## ANNEXES

### Annexe A — Méthodologie
- **OWASP ASVS 4.0** — Application Security Verification Standard
- **OWASP Top 10 2021** — A01 à A10
- **OWASP API Top 10 2023** — API1 à API10
- **CWE/SANS Top 25** — Most Dangerous Software Weaknesses
- **CVSS v3.1** — Common Vulnerability Scoring System
- **NIST SP 800-53 Rev.5** — Security and Privacy Controls
- **GDPR Art. 5** — Principes de traitement des données personnelles

### Annexe B — Fichiers analysés (55 fichiers)

**Routes API** : `app/api/applications/route.ts`, `app/api/applications/[id]/route.ts`, `app/api/auth/gmail/callback/route.ts`, `app/api/auth/gmail/connect/route.ts`, `app/api/emails/sync/route.ts`, `app/api/jobs/fetch/route.ts`, `app/api/offers/route.ts`, `app/api/offers/[id]/route.ts`, `app/api/search-profiles/route.ts`, `app/api/search-profiles/[id]/route.ts`, `app/api/stats/route.ts`, `app/api/assistant/process/route.ts`

**Pages** : `app/page.tsx`, `app/layout.tsx`, `app/login/page.tsx`, `app/test/page.tsx`, `app/applications/page.tsx`, `app/offers/page.tsx`, `app/search/page.tsx`, `app/settings/page.tsx`

**Lib** : `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/types.ts`, `lib/scrapers/apec.ts`, `lib/scrapers/france-travail.ts`, `lib/scrapers/hellowork.ts`, `lib/scrapers/jsearch.ts`, `lib/email/gmail.ts`, `lib/email/parser.ts`, `lib/assistant/groq.ts`

**Config** : `middleware.ts`, `next.config.ts`, `netlify.toml`, `netlify/functions/fetch-jobs.ts`, `netlify/functions/sync-emails.ts`, `.gitignore`, `.env.local.example`

### Annexe C — Score de scoring détaillé

```
╔══════════════════════════════════════════════════════════════╗
║              RAPPORT D'AUDIT SÉCURITÉ                       ║
║              Projet : JobTrackeria  |  Date : 2026-06-05    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  SCORE GLOBAL : 78/100  ████████████████░░░░  GÉRÉ (Niv.4) ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  1. Structure & Arborescence      68/100  (8%)  → 5.44 pts ║
║  2. Authentification & Sessions   82/100  (15%) → 12.30 pts║
║  3. Contrôle d'accès              90/100  (10%) → 9.00 pts ║
║  4. Injections & Validation       82/100  (15%) → 12.30 pts║
║  5. Cryptographie                 75/100  (10%) → 7.50 pts ║
║  6. Gestion erreurs & Logs        80/100  (7%)  → 5.60 pts ║
║  7. Dépendances                   90/100  (10%) → 9.00 pts ║
║  8. Secrets & Configuration       62/100  (10%) → 6.20 pts ║
║  9. Architecture                  78/100  (8%)  → 6.24 pts ║
║ 10. API & Communication           70/100  (7%)  → 4.90 pts ║
╠══════════════════════════════════════════════════════════════╣
║  Findings : 0 Critical | 5 High | 10 Medium | 9 Low        ║
╚══════════════════════════════════════════════════════════════╝
```

### Annexe D — Glossaire

| Terme | Définition |
|-------|------------|
| CVSS | Common Vulnerability Scoring System |
| CWE | Common Weakness Enumeration |
| OWASP ASVS | Application Security Verification Standard |
| IDOR | Insecure Direct Object Reference |
| XSS | Cross-Site Scripting |
| CSP | Content Security Policy |
| HSTS | HTTP Strict Transport Security |
| RLS | Row Level Security (Supabase) |
| LLM | Large Language Model |
| SSRF | Server-Side Request Forgery |
