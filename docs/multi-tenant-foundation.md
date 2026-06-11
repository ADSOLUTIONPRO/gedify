# Multi-tenant SaaS — Phase 1 (fondations)

Socle multi-tenant **additif et inactif par défaut**. Tout est conditionné par
l'environnement `MULTI_TENANT` : tant qu'il n'est pas activé, le comportement est
strictement identique à aujourd'hui → **aucun impact** sur `main`, Docker
Synology, le local, ni `gedify.azserver.fr`.

> Phase 1 = **fondations uniquement**. On ne branche **pas** encore `tenant_id`
> sur les tables métier (documents, tags…). Ce sera une étape ultérieure.

## Modèles Prisma ajoutés (`prisma/schema.prisma`)

- **Tenant** — `id` (= slug), `name`, `slug` (unique), `plan`, `status`,
  `raw`, `created_at`, `updated_at`.
- **Membership** — `id` (`${tenantId}:${userId}`), `user_id`, `tenant_id`,
  `role` (owner | admin | member | viewer), `created_at`, `updated_at`
  (unique `(tenant_id, user_id)`).
- **TenantSettings** — `id` (= tenantId), `tenant_id` (unique), `max_users`,
  `max_documents`, `max_storage_mb`, `ai_enabled`, `ocr_enabled`,
  `email_import_enabled`, `onlyoffice_enabled`, `created_at`, `updated_at`.

Tables **additives** (nullable / valeurs par défaut) → `prisma db push` sûr.

## Activation

| Variable | Effet |
| --- | --- |
| `MULTI_TENANT=true` | Active la résolution réelle du tenant (SaaS). Absent/false → mode mono-tenant (tenant par défaut synthétique, aucun accès base). |

Sélection du tenant courant (mode activé) : en-tête `x-tenant-id` ou cookie
`gedify-tenant` s'ils correspondent à une adhésion, sinon la première adhésion.

## Helpers serveur (`src/lib/tenant/`)

- `get-current-tenant.ts`
  - `getCurrentTenant()` → `{ userId, tenantId, tenant, role }`. Mono-tenant :
    renvoie le tenant `default` (role `owner`). Multi-tenant : lève
    `TenantAccessError` si non connecté ou sans tenant.
  - `requireTenant()` — alias qui lève si non résolu.
  - `requireTenantRole(["owner","admin"])` — lève si rôle insuffisant.
  - `isTenantOwner()` — booléen (jamais d'exception).
  - `assertTenantAccess(tenantId)` — confine une ressource au tenant courant.
- `tenant-config.ts` — `isMultiTenantEnabled()`, `DEFAULT_TENANT`, rôles.
- `tenant-store.ts` — lecture Postgres (tenants / memberships / tenant_settings).
- `types.ts` — `Tenant`, `Membership`, `TenantSettings`, `TenantContext`.

## Tenant initial

Script idempotent **autonome** (`pg`, sans CLI Prisma ni tsx) :
`scripts/saas/create-initial-tenant.ts` → bundle committé
`scripts/saas/create-initial-tenant.mjs` (via `npm run build:scripts`).

> Le `npm run saas:init-tenant` utilise **`node` + bundle `.mjs`** (et non `tsx`)
> car `tsx` n'est pas présent dans l'image runtime — c'est le pattern du projet
> (cf. `scripts/db-push.ts` → `scripts/gedify-db-push.mjs`).

Il : crée les tables si besoin (IF NOT EXISTS), crée le tenant
**AzServer Staging** (slug `azserver-staging`, plan `internal`, statut `active`),
trouve l'admin (`is_superuser`) et lui crée un **membership owner**, plus une
ligne `tenant_settings` par défaut. Relançable sans doublon.

## Page admin

`/admin/saas/tenant` (réservée admin) : tenant courant, slug, plan, statut, rôle
de l'utilisateur, et limites `tenant_settings`.

## Commandes (terminal Coolify de l'app, après déploiement)

```bash
npm run db:push          # applique le schéma (tenants/memberships/tenant_settings)
npm run db:generate      # régénère le client Prisma
npm run saas:init-tenant # crée le tenant initial + membership owner (idempotent)
```

Pour activer la résolution multi-tenant : définir `MULTI_TENANT=true` (Runtime)
puis redéployer. Sans cette variable, tout reste en mono-tenant.

## Phase 2 — `tenant_id` sur les tables métier principales

Ajout **progressif** de `tenant_id` (nullable, indexé) sur 5 tables :
`documents`, `tags`, `correspondents`, `document_types`, `folders`. Le filtrage
et le **confinement des écritures** par tenant ne s'activent **que** si
`MULTI_TENANT=true` **et** qu'un tenant est résolu (contexte requête).

### Comportement (gardé)

- `src/lib/tenant/tenant-scope.ts` : `TENANT_SCOPED_TABLES` + `activeTenantIdFor(table)`
  → renvoie le tenant actif, ou `null` (mono-tenant, hors requête / job de fond,
  non authentifié) ⇒ **comportement historique strict** (aucun filtre, aucune
  colonne `tenant_id` touchée).
- Lectures (`engine-pg.readCollectionPg`, `pg-store.pgReadAll` / `pgReadByJsonIds`) :
  filtrées `WHERE tenant_id = <actif>` uniquement si un tenant est résolu.
- Écritures « remplacement de collection » (`writeCollectionPg`, `pgWriteAll`) :
  estampillage `tenant_id` à l'INSERT (jamais modifié en UPDATE), et **suppression
  CONFINÉE** au tenant courant (`DELETE … WHERE tenant_id = <actif> AND id NOT IN …`)
  → **jamais** de suppression des lignes d'un autre tenant. Lecture-scope et
  delete-scope reposent sur la même résolution ⇒ cohérence garantie.

> **Rollback instantané** : `MULTI_TENANT=false` désactive TOUT le tenant-scoping
> (lectures/écritures redeviennent à l'identique) sans redéploiement de code.

### Rattachement des données existantes

Script idempotent `scripts/saas/backfill-tenant-id.ts` → bundle
`scripts/saas/backfill-tenant-id.mjs` (`npm run saas:backfill-tenant`) : ajoute
`tenant_id` si absent, crée l'index, et affecte `tenant_id = azserver-staging`
(surchargeable via `TENANT_ID`) aux lignes `NULL`. Relançable sans effet.

### Commandes (Coolify, après déploiement)

```bash
npm run db:push             # ajoute tenant_id aux 5 tables (idempotent)
npm run db:generate         # régénère le client Prisma
npm run saas:backfill-tenant # rattache l'existant à azserver-staging (idempotent)
# MULTI_TENANT=true (déjà actif) → filtrage par tenant effectif
```

## Étapes suivantes (hors Phase 2)

- Étendre `tenant_id` aux autres tables métier (budget, mails, reminders, tasks…).
- Sélecteur de tenant (UI) + résolution par sous-domaine.
- CRUD tenants/memberships + invitations + application des limites + jobs de fond
  tenant-aware.
