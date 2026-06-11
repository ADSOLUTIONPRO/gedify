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

### Tables couvertes & relations

`tenant_id` (colonne nullable indexée, **pas** de FK dure — cohérent avec le
style blob du schéma) sur : `documents`, `tags`, `correspondents`,
`document_types`, `folders`, plus `document_files` et `document_correspondents`.

> `document_tags` et `folder_documents` ne sont **pas** scopés : ces relations
> sont **embarquées dans le blob du parent** (tags = `document.tags`, liens
> dossier = `folder.linkedDocumentIds`) → déjà isolées via le `tenant_id` du
> parent. `document_correspondents` (correspondants secondaires) suit un chemin
> « replace complet » cohérent : la colonne est ajoutée + rattachée, mais le
> stamping runtime reste à brancher (risque résiduel mineur, défense en
> profondeur — isolation fonctionnelle déjà assurée par le document).

### Helpers de requêtes (`tenant-scope.ts`)

`isMultiTenantEnabled()`, `getTenantWhere(tenantId)`, `withTenantId(data, tenantId)`,
`tenantScopedWhere(baseWhere, tenantId)`, `requireSameTenant(recordTenantId,
currentTenantId)` — tous **no-op** si `tenantId` est null (mono-tenant) → pour
adopter le scoping explicitement dans de futures routes sans répéter `tenant_id`.

### Page admin — couverture

`/admin/saas/tenant` affiche le **nombre de documents / tags / correspondants /
types / dossiers** du tenant courant (`getTenantCounts`), en plus du diagnostic.

### Rattachement des données existantes

Script idempotent **complet** `scripts/saas/attach-existing-data-to-tenant.ts` →
bundle `.mjs` (`npm run saas:attach-data`) : ajoute `tenant_id` si absent, crée
l'index, et affecte `tenant_id = azserver-staging` (surchargeable via
`TENANT_ID`) aux lignes `NULL` des 7 tables ci-dessus, avec un résumé par table.
Relançable sans effet. (Le précédent `saas:backfill-tenant`, sous-ensemble des 5
tables cœur, reste disponible.)

### Commandes (Coolify, après déploiement)

```bash
npm run db:push             # ajoute tenant_id aux 5 tables (idempotent)
npm run db:generate         # régénère le client Prisma
npm run saas:backfill-tenant # rattache l'existant à azserver-staging (idempotent)
# MULTI_TENANT=true (déjà actif) → filtrage par tenant effectif
```

## Phase 3 — Durcissement de l'isolation (avant 2ᵉ tenant)

### Jobs de fond tenant-aware

`src/lib/tenant/tenant-context.ts` : contexte ambiant via `AsyncLocalStorage`
(`runWithTenant(tenantId, fn)` / `getAmbientTenantId()`). `getActiveTenantId()`
consulte ce contexte **en priorité** (hors requête, pas de session).

Le worker pipeline (`src/lib/jobs/job-worker.ts`) résout le tenant du document
du job (`getDocumentTenantId`) et exécute `runJob` **dans** `runWithTenant(tenant,…)`
→ toutes les lectures/écritures du job sont filtrées et confinées à ce tenant.
Le `tenantId` est **journalisé** par job ; un document sans `tenant_id` est
signalé (warning) plutôt que traité « tous tenants ».

### `document_correspondents` strict

Ajouté à `TENANT_SCOPED_TABLES`. `pgReadDocCorrespondents` filtre par tenant ;
`pgWriteDocCorrespondents` **estampille** `tenant_id` à l'INSERT et **confine** le
DELETE (`WHERE role = … AND tenant_id = …`). `forbidGlobalDeleteInMultiTenant`
empêche tout DELETE global par rôle quand `MULTI_TENANT` est actif.

### `document_files`

**Non utilisé au runtime** : les fichiers (originaux, miniatures, aperçus) sont
sur le **système de fichiers** (`saveOriginal`/`saveThumbnail`…), pas dans cette
table. La colonne `tenant_id` existe (réservée) et est couverte par les
diagnostics ; aucun branchement runtime nécessaire tant que la table n'est pas
utilisée.

### Garde-fous anti-fuite (`tenant-scope.ts`)

Tous **neutres** en mono-tenant : `assertRecordInTenant`,
`assertRelationSameTenant`, `forbidGlobalWriteInMultiTenant`,
`forbidGlobalDeleteInMultiTenant`, `requireTenantIdWhenMultiTenant`. Plus les
helpers Phase 2 (`getTenantWhere`, `withTenantId`, `tenantScopedWhere`,
`requireSameTenant`). À utiliser aux points sensibles ; déjà câblés dans le
chemin `document_correspondents`. L'isolation lecture/écriture des collections
cœur reste assurée centralement par la couche de stockage (engine-pg/pg-store).

### Diagnostic & vérification

- `/admin/saas/tenant` : compteurs par tenant **+ « lignes sans tenant_id »**
  (documents, tags, correspondents, document_types, folders,
  document_correspondents, document_files) avec **alerte rouge** si
  `MULTI_TENANT=true` et qu'il reste des orphelines.
- `npm run saas:check-isolation` (`scripts/saas/check-tenant-isolation.ts`) :
  contrôle en lecture seule (tenants actifs, lignes sans tenant_id, cohérence des
  relations document_correspondents ↔ document/correspondant), **exit 0 si OK,
  exit 1 si fuite/incohérence**.

## Phase 4 — 2ᵉ tenant & vérification d'isolation

### Tenant de test

`npm run saas:create-test-tenant` (`scripts/saas/create-test-tenant.ts`,
idempotent) crée : l'utilisateur **clienttest** / `clienttest@gedify.local`
(**non superuser**, mot de passe `ClientTest123!`), le tenant **test-client**
(Client Test, plan `test`, actif), un membership **owner**, et ses
`tenant_settings` (max_users 3, max_documents 50, max_storage_mb 500, IA+OCR+
OnlyOffice activés, import email désactivé).

### Pages superuser globales

- `/admin/saas/tenants` — liste de tous les tenants (slug, plan, statut, nb
  users/documents/tags/correspondants) + lien détails. **Accès `is_superuser`
  uniquement** (un owner de tenant non-superuser est refusé).
- `/admin/saas/tenants/[tenantId]` — diagnostic d'un tenant (infos, memberships,
  compteurs/limites, lignes sans tenant_id, derniers documents). **Superuser
  uniquement.** Lecture seule (aucune action métier) → le superuser diagnostique
  sans changer son tenant d'action.

### Résolution du tenant (interface)

`getCurrentTenant()` résout via **membership** : le cookie `gedify-tenant` /
l'en-tête `x-tenant-id` ne peuvent désigner qu'un tenant dont l'utilisateur est
**membre** (`memberships.find(... === selected)`). Un utilisateur non-superuser
ne peut donc **jamais** choisir librement un `tenant_id`. Le superuser passe par
les pages de diagnostic (par paramètre, en lecture seule) ; les actions métier
restent scopées à son propre tenant.

### Test d'isolation 2 tenants

`npm run saas:test-two-tenants` (`scripts/saas/test-two-tenant-isolation.ts`) :
crée des lignes-témoins (documents/tags/correspondents) dans `azserver-staging`
et `test-client`, vérifie qu'une requête scopée à un tenant ne voit jamais les
témoins de l'autre (et voit bien les siens), puis nettoie. **exit 0 si OK,
exit 1 si fuite.**

## Phase 5 — Résolution & sélection du tenant

### Tenant actif (stockage)

Cookie **httpOnly** `gedify-tenant` (`TENANT_COOKIE_NAME`), posé **côté serveur**
par une server action après **validation du membership** ; `secure`/`sameSite=lax`/
`path=/`/30 j. Il reste **revalidé** à chaque résolution (`getCurrentTenant`) →
un cookie trafiqué vers un tenant non-membre est ignoré (retombe sur le 1ᵉʳ
membership). Aucune route métier ne prend de `tenant_id` du frontend sans cette
validation serveur.

### Résolution (`getCurrentTenant` / `getTenantNav`)

Ordre : MULTI_TENANT off → mono-tenant ; user absent → erreur/redirect login ;
tenant sélectionné (cookie/header) **validé membership** → lui ; sinon **un seul**
tenant accessible → auto ; sinon (plusieurs, aucun) → **sélection requise**.
`getTenantNav()` (1 résolution/requête) alimente le layout (redirect) et le badge.

### Flux d'interface

- `/select-tenant` (server action `selectTenantAction`) : liste les espaces
  accessibles (nom, slug, rôle, plan, statut). **1 espace → entrée directe** ;
  **plusieurs → choix**. Écran dédié (sans AppShell) mais authentifié.
- Le **layout** redirige vers `/select-tenant` quand une sélection est requise
  (exempté : `/select-tenant` et `/admin/saas/*`).
- **`TenantBadge`** (bandeau slim, multi-tenant only) : « Nom · rôle » +
  « Changer d'espace » si plusieurs espaces.

### Comportements

- **admin (superuser, 1 membership azserver-staging)** : entre directement dans
  AzServer Staging ; accède à `/admin/saas/tenants` (global) ; diagnostique les
  autres tenants en lecture seule (les actions métier restent sur son tenant).
- **clienttest (1 membership test-client)** : entre **automatiquement** dans
  Client Test ; **pas** d'accès `/admin/saas/tenants` ; ne peut pas sélectionner
  AzServer Staging (non-membre) ; ne voit aucune donnée d'AzServer Staging.

### Sous-domaines (préparé, NON actif)

`resolveTenantFromHost(host)` (`src/lib/tenant/resolve-host.ts`) déduit un slug
depuis `client.gedify.fr` ; les domaines portail (`app/staging.gedify.fr`)
renvoient null. **Non branché** — la résolution reste par membership.

## Phase 6 — Onboarding contrôlé (sans Stripe)

### Création de tenant (superuser)

- Page `/admin/saas/create-tenant` (superuser only) : nom, slug, e-mail +
  identifiant + mot de passe temporaire de l'owner, plan
  (`free|test|pro|business|internal`), statut (`active|trial|suspended`),
  limites (max_users/documents/storage_mb) et fonctionnalités (ai/ocr/
  email_import/onlyoffice).
- À la validation (`createTenantWithOwner`, `src/lib/tenant/tenant-admin.ts`) :
  crée le tenant (slug = id), **crée ou réutilise** l'owner (par e-mail/
  identifiant ; refuse une incohérence e-mail≠identifiant), crée le membership
  owner, crée `tenant_settings`. **Refuse un slug déjà pris.** L'owner ayant un
  seul espace, il y entre automatiquement à la connexion (Phase 5). Ne crée
  **aucune** donnée métier.

### Édition de tenant (superuser)

`/admin/saas/tenants/[tenantId]` : en plus du diagnostic, le superuser peut
modifier **plan/statut**, **limites/fonctionnalités**, et **suspendre/réactiver**
(`updateTenant`, `updateTenantSettings`, `setTenantStatus`).

### CLI

`npm run saas:create-tenant -- --slug=demo --name="Demo" --email=demo@gedify.local`
(`scripts/saas/create-tenant.ts`, idempotent) — options `--username --password
--plan --status --max-users --max-documents --max-storage-mb --ai/--ocr/
--email-import/--onlyoffice`.

### Audit

`recordAudit` journalise : `tenant_created`, `tenant_updated`,
`tenant_suspended`, `membership_created`, `tenant_settings_updated` (visible dans
les journaux / la Santé).

### Sécurité

Toutes les pages/actions d'onboarding et d'édition sont **`is_superuser`
uniquement** (un owner client ne peut ni créer un tenant, ni modifier son
plan/statut/limites). Les actions métier restent tenant-scopées (Phases 2–3) ;
aucune donnée métier n'est créée sans `tenant_id` en multi-tenant.

## Phase 7 — Plans, quotas & restrictions (sans Stripe)

- `src/lib/saas/plans.ts` : config centralisée `free|test|pro|business|internal`
  (limites + features + label/description/support). `null` = illimité.
- `src/lib/saas/quota.ts` : `getTenantPlanLimits` (tenant_settings, sinon défauts
  du plan), `getTenantUsage` (users/documents/storageMb), `check*Quota`,
  `assertFeatureEnabled`, `canUse*`, et gardes `enforceDocumentQuota` /
  `featureGate(feature)` / `userQuotaGate` (NO-OP hors MULTI_TENANT ou sans
  tenant actif).
- **Bloquant** : création/import document (`consume` → `enforceDocumentQuota` :
  maxDocuments + stockage ; `archiveSize` enregistré au blob), IA
  (`/api/ai/analyze-document`, `/api/documents/[id]/reanalyze`), OCR
  (`/api/documents/[id]/redo-ocr`), import email
  (`/api/mail-connector/accounts/[id]/sync`), OnlyOffice
  (`onlyoffice-config`), création utilisateur (`/api/paperless/users`).
  Messages propres (« Limite de documents atteinte pour votre offre. » …).
- Admin : `/admin/saas/tenant` (owner) et `/admin/saas/tenants/[tenantId]`
  (superuser) affichent **usage vs limites** ; le superuser peut « appliquer les
  limites du plan » (`applyPlanToSettings`) + surcharge manuelle (Phase 6).
- `npm run saas:check-quotas` : usage/limites par tenant, exit 1 si dépassement.
- Sécurité : quotas vérifiés **côté serveur** ; un owner ne peut pas augmenter
  ses quotas (édition = superuser). Stockage = best-effort (somme `archiveSize`,
  documents créés après la Phase 7).

## Étapes suivantes (hors Phase 6)

- Étendre `tenant_id` aux autres tables métier (budget, mails, reminders, tasks…).
- **Application** effective des limites (max_users / max_documents / max_storage_mb).
- Sélecteur superuser pour AGIR dans un tenant ; activation sous-domaines.
- Invitations de membres ; Stripe ; inscription publique.
