# Security Audit Report — JobTrackeria

**Date:** 2026-06-04  
**Stack:** Next.js 16.2.7 / Supabase / Netlify  
**Score global:** 6.5 / 10

---

## Résumé exécutif

L'application présente une architecture correcte (auth Supabase côté serveur, middleware de redirection, RLS implicite via `user_id` dans chaque requête). Les problèmes les plus sérieux sont des **mass assignment** sur plusieurs routes POST/PATCH — un utilisateur authentifié peut injecter des champs arbitraires dans la DB. Aucune vuln critique d'injection SQL (Supabase paramétrise). Pas de secrets hardcodés. Aucun IDOR (chaque requête filtre `.eq('user_id', user.id)`).

---

## Vulnérabilités

### 🔴 HIGH — Mass assignment POST /api/applications

**Fichier:** `app/api/applications/route.ts:44`

```typescript
// VULNÉRABLE
const body = await req.json()
await supabase.from('applications').insert({ ...body, user_id: user.id })
```

L'utilisateur peut envoyer n'importe quel champ : `created_at`, `updated_at`, `id` (UUID arbitraire), `source: 'import'`, etc. `user_id` est bien overridé mais tous les autres champs passent directement.

**Impact:** Pollution de données, bypass de logique métier, UUID collision potentielle.

---

### 🔴 HIGH — Mass assignment POST /api/search-profiles

**Fichier:** `app/api/search-profiles/route.ts:27`

```typescript
// VULNÉRABLE
await supabase.from('search_profiles').insert({ ...body, user_id: user.id })
```

L'utilisateur peut injecter `created_at`, ou forcer `actif: true` sur plusieurs profils simultanément (la logique de désactivation est seulement dans le PATCH).

---

### 🔴 HIGH — Unrestricted field update PATCH /api/offers/[id]

**Fichier:** `app/api/offers/[id]/route.ts:12`

```typescript
// VULNÉRABLE
const body = await req.json()
delete body.user_id
delete body.id
// → update(body) accepte raw_data, source, date_scraped, titre, tout
```

`raw_data` est un JSONB large — un utilisateur peut écraser n'importe quel champ, y compris `raw_data` avec un payload volumineux (proto-pollution indirecte, DoS storage).

---

### 🔴 HIGH — Unrestricted field update PATCH /api/applications/[id]

**Fichier:** `app/api/applications/[id]/route.ts:32`

Même pattern — seuls `user_id` et `id` sont supprimés, tout le reste passe. Un utilisateur peut modifier `source`, `created_at`, etc.

---

### 🟡 MEDIUM — Pas de security headers HTTP

**Fichier:** `next.config.ts`

Aucun header `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. L'application peut être embarquée en iframe (clickjacking), les navigateurs anciens sniffent le MIME type.

---

### 🟡 MEDIUM — CVE dans postcss (dépendance Next.js)

**CVE:** GHSA-qx2v-qp2m-jg93 — PostCSS < 8.5.10 — XSS via `</style>` non échappé en CSS stringify output.

```
npm audit: 2 moderate vulnerabilities
postcss <8.5.10 in node_modules/next/node_modules/postcss
```

**Mitigation:** Ajouter dans `package.json` :
```json
"overrides": { "postcss": ">=8.5.10" }
```

---

### 🟡 MEDIUM — Wildcard hostname trop large pour Next/Image

**Fichier:** `next.config.ts:10`

```typescript
{ protocol: 'https', hostname: '*.googleapis.com' }
```

`*.googleapis.com` couvre des dizaines de services Google non nécessaires (ex: `storage.googleapis.com`, `drive.googleapis.com`). Restreindre à `lh3.googleusercontent.com` pour les logos employeurs.

---

### 🟢 LOW — Messages d'erreur Supabase exposés

**Fichiers:** tous les route handlers

```typescript
return NextResponse.json({ error: error.message }, { status: 500 })
```

Les messages d'erreur Supabase peuvent révéler le nom des tables, colonnes, ou contraintes. Loguer côté serveur, retourner message générique côté client.

---

### 🟢 LOW — Rate limiting insuffisant

`/api/applications` POST, `/api/search-profiles` POST n'ont aucune protection contre le spam. Seul `/api/jobs/fetch` a un throttle 2 minutes. Un utilisateur authentifié peut créer des milliers d'enregistrements.

---

## Top 5 priorités

1. **Whitelister les champs autorisés** dans tous les POST/PATCH (corrigé ci-dessous)
2. **Ajouter security headers** dans `next.config.ts` (corrigé ci-dessous)
3. **Overrider postcss** vers ≥ 8.5.10 dans `package.json`
4. **Restreindre `*.googleapis.com`** à `lh3.googleusercontent.com`
5. **Ajouter rate limiting** sur les endpoints d'écriture (ex: Upstash Redis ou simple in-memory avec `LRU`)

---

*Pas de secrets hardcodés trouvés. Pas d'IDOR (user_id filtré partout). Pas de SQL injection (Supabase paramétrise). OAuth CSRF state validé correctement.*
