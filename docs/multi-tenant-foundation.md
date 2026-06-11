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

## Étapes suivantes (hors Phase 1)

- Ajouter `tenant_id` (progressif) sur les tables métier + filtrage par tenant.
- Sélecteur de tenant (UI) + résolution par sous-domaine.
- CRUD tenants/memberships + invitations + application des limites.
