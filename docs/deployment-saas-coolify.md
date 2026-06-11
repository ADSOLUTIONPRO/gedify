# Déploiement SaaS sur Coolify (staging / production)

Ce document décrit la préparation et l'exploitation de Gedify en mode **SaaS**
sur **Coolify**, avec deux environnements isolés (**staging** et **production**).

> ⚠️ La **migration multi-tenant n'est pas encore faite**. Cette préparation se
> limite à l'isolation des environnements (variables, banner, diagnostic, doc).
> Chaque environnement reste pour l'instant **mono-instance**.

---

## 1. Branches & cibles

| Branche           | Rôle                                                        | Cible                                            |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| `main`            | **Version stable actuelle** (NE PAS impacter)             | `gedify.azserver.fr` + **Docker Synology**       |
| `saas-staging`    | Environnement **SaaS de test** (chantier en cours)         | Coolify — application **staging**                |
| `saas-production` | **Future production SaaS**                                  | Coolify — application **production**             |

Règles absolues :

- `main` reste la version stable utilisée par `gedify.azserver.fr` et le conteneur
  Docker Synology. **On ne pousse jamais sur `main`** depuis le chantier SaaS.
- Tout le travail SaaS se fait sur `saas-staging`.
- `saas-production` ne reçoit que du code **déjà validé sur staging** (merge).

---

## 2. Organisation Coolify

Créer **un projet Coolify « Gedify SaaS »** contenant **deux environnements**
(ou deux applications), strictement séparés :

```
Projet : Gedify SaaS
├── Application : gedify-staging      ← branche saas-staging
│   ├── PostgreSQL (staging)
│   ├── Redis (staging)
│   └── Volume stockage (staging)
└── Application : gedify-production   ← branche saas-production
    ├── PostgreSQL (production)
    ├── Redis (production)
    └── Volume stockage (production)
```

- **Build** : Nixpacks (pas le Dockerfile). La version de Node vient de `.nvmrc`
  + `engines` du `package.json`, **pas** du `FROM` du Dockerfile.
- **Auto-deploy** : chaque application est branchée sur **sa** branche Git
  (`saas-staging` → staging, `saas-production` → production). Activer le déploiement
  automatique sur push.
- **Healthcheck** : `GET /api/health` (route publique, statut « ok » sans donnée
  sensible).

> Les variables `NEXT_PUBLIC_*` sont **inlinées au build** par Next.js. Elles
> doivent donc être présentes **au moment du build** Coolify (variables
> « Build & Runtime »), pas seulement au runtime.

---

## 3. Variables d'environnement

### Variables communes (préparation SaaS)

| Variable               | Rôle                                                              |
| ---------------------- | ---------------------------------------------------------------- |
| `APP_ENV`              | Environnement applicatif serveur : `staging` \| `production`     |
| `NEXT_PUBLIC_APP_ENV`  | Idem, exposé au navigateur (pilote le bandeau staging)           |
| `APP_URL`              | URL applicative côté serveur (liens absolus, callbacks)          |
| `NEXT_PUBLIC_APP_URL`  | URL publique exposée au navigateur                               |
| `DATABASE_URL`         | Connexion PostgreSQL (secret — jamais affichée)                  |
| `REDIS_URL`            | Connexion Redis (secret — jamais affichée)                       |
| `STORAGE_DRIVER`       | Pilote de stockage des fichiers : `local` (défaut) \| `s3` \| …  |
| `STORAGE_ROOT`         | Racine du stockage (chemin disque ou bucket)                     |
| `STORAGE_PREFIX`       | Préfixe de clés (isole staging/prod, futur tenant)              |
| `AUTH_SECRET`          | Secret de signature des sessions (≥ 32 caractères)              |
| `GEDIFY_STORAGE_MODE`  | Mode base de données : `postgres` en SaaS                       |
| `AI_PROVIDER`          | Fournisseur IA (`mock` par défaut, `openai`, `ollama`…)         |
| `EMAILS_ENABLED`       | Active l'envoi d'emails (`true`/`false`)                        |
| `STRIPE_MODE`          | `test` \| `live` \| `off` (la clé reste dans `STRIPE_SECRET_KEY`)|

> Le **mode base** (`GEDIFY_STORAGE_MODE`) et le **stockage des fichiers**
> (`STORAGE_DRIVER`/`STORAGE_ROOT`/`STORAGE_PREFIX`) sont **deux notions
> distinctes** : la première concerne les métadonnées en base, la seconde les
> fichiers (binaires).

### Variables staging

```dotenv
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
APP_URL=https://staging.gedify.example.com
NEXT_PUBLIC_APP_URL=https://staging.gedify.example.com

# Base & cache DÉDIÉS staging (jamais partagés avec la prod)
GEDIFY_STORAGE_MODE=postgres
DATABASE_URL=postgresql://USER:PASS@gedify-staging-pg:5432/gedify_staging
REDIS_URL=redis://gedify-staging-redis:6379

# Stockage fichiers isolé
STORAGE_DRIVER=local
STORAGE_ROOT=/data/staging
STORAGE_PREFIX=staging

# Sécurité (secret PROPRE à staging)
AUTH_SECRET=<secret-aléatoire-long-staging>
COOKIE_SECURE=true

# Services
AI_PROVIDER=mock
EMAILS_ENABLED=false
STRIPE_MODE=test
```

#### Connexion admin en staging (admin par défaut)

En **staging uniquement** (`APP_ENV=staging` ou `NEXT_PUBLIC_APP_ENV=staging`), si
aucun identifiant d'amorçage n'est fourni, l'application crée automatiquement un
administrateur par défaut au premier accès :

| Adresse e-mail (login)          | Mot de passe |
| ------------------------------- | ------------ |
| `hello.adsolutionpro@gmail.com` | `admin`      |

> Le formulaire de connexion attend une **adresse e-mail** (champ `type="email"`) :
> connectez-vous avec l'e-mail ci-dessus, pas avec l'identifiant `admin`.

- Pré-requis : **`AUTH_SECRET` doit être défini** (sinon la connexion renvoie
  « Authentification non configurée »).
- Ce comportement est **strictement réservé au staging** (jamais en dev, en
  production / `saas-production`, sur `main` ni sur Docker Synology, qui ne posent
  jamais `APP_ENV=staging`).
- **Surcharger** les identifiants par défaut :
  ```dotenv
  GEDIFY_ADMIN_USER=mon-admin
  GEDIFY_ADMIN_PASSWORD=un-mot-de-passe-fort
  GEDIFY_ADMIN_MAIL=mon-admin@exemple.com
  ```
- **Réinitialiser** un admin existant dont le mot de passe est perdu (volume
  recréé, bascule de backend…) :
  ```dotenv
  GEDIFY_ADMIN_RESET=true
  ```
- ⚠️ `admin/admin` est volontairement faible : **changez le mot de passe** depuis
  l'interface (ou via `GEDIFY_ADMIN_*`) dès la première connexion.

### Variables production

```dotenv
APP_ENV=production
NEXT_PUBLIC_APP_ENV=production
APP_URL=https://app.gedify.example.com
NEXT_PUBLIC_APP_URL=https://app.gedify.example.com

# Base & cache DÉDIÉS production
GEDIFY_STORAGE_MODE=postgres
DATABASE_URL=postgresql://USER:PASS@gedify-prod-pg:5432/gedify_prod
REDIS_URL=redis://gedify-prod-redis:6379

# Stockage fichiers isolé
STORAGE_DRIVER=local
STORAGE_ROOT=/data/production
STORAGE_PREFIX=prod

# Sécurité (secret PROPRE à la prod, DIFFÉRENT de staging)
AUTH_SECRET=<secret-aléatoire-long-production>
COOKIE_SECURE=true

# Services
AI_PROVIDER=openai          # ou ollama / mock selon l'offre
EMAILS_ENABLED=true
STRIPE_MODE=live
```

> En production, `NEXT_PUBLIC_APP_ENV=production` ⇒ le bandeau orange « staging »
> ne s'affiche **pas**. Il n'apparaît **que** quand `NEXT_PUBLIC_APP_ENV=staging`.

---

## 4. PostgreSQL staging / production séparés

- **Une base PostgreSQL par environnement** : `gedify_staging` et `gedify_prod`,
  sur des services Coolify distincts (idéalement deux conteneurs PG séparés).
- **Jamais** de `DATABASE_URL` partagée entre staging et prod.
- Les sauvegardes Coolify (snapshots PG) sont configurées **par base**.
- Le `prisma generate` est lancé au build (`npm run build`). Aucune migration
  destructive n'est exécutée automatiquement : les changements de schéma se font
  d'abord sur staging.

## 5. Redis staging / production séparés

- **Un Redis par environnement** (`REDIS_URL` distincte). Aucune mutualisation :
  un flush staging ne doit jamais toucher la prod.
- Redis est utilisé pour le cache / files d'attente (préparation). Si `REDIS_URL`
  est absente, l'application reste fonctionnelle (dégradation propre).

## 6. Volumes séparés

- **Un volume de stockage par environnement**, monté sur `STORAGE_ROOT` :
  - staging → `/data/staging`
  - production → `/data/production`
- `STORAGE_PREFIX` (`staging` / `prod`) isole en plus les clés à l'intérieur du
  driver — utile pour un futur backend objet (S3) partagé.
- Aucun volume partagé entre staging et prod.

## 7. Domaines recommandés

| Environnement | Domaine recommandé                  |
| ------------- | ----------------------------------- |
| Staging       | `staging.gedify.example.com`        |
| Production    | `app.gedify.example.com`            |

- TLS automatique via Coolify (Let's Encrypt).
- `COOKIE_SECURE=true` partout (HTTPS attendu).
- `gedify.azserver.fr` **reste** servi par l'infra `main`/Synology — **inchangé**.

---

## 8. Procédure de déploiement staging

1. Travailler sur `saas-staging` (vérifier `git branch --show-current`).
2. Valider en local :
   ```bash
   npm run build      # prisma generate + next build
   npm run lint
   ```
3. Committer puis pousser sur `saas-staging` :
   ```bash
   git push origin saas-staging
   ```
4. Coolify (application **staging**) déclenche le build Nixpacks et déploie.
5. Vérifier après déploiement :
   - `GET /api/health` → `ok`
   - Bandeau orange **« Environnement staging — données de test »** visible.
   - Page **`/admin/system/environment`** (admin) : `APP_ENV=staging`, bases &
     Redis « Oui », stockage attendu — **aucun secret** affiché.

## 9. Procédure de merge `saas-staging` → `saas-production`

Quand une version staging est validée :

```bash
git checkout saas-production
git merge --no-ff saas-staging
git push origin saas-production
```

- Coolify (application **production**) déploie automatiquement.
- Vérifier sur le domaine de prod : **pas** de bandeau staging, et
  `/admin/system/environment` indique `APP_ENV=production`.
- **Ne jamais** merger vers `main` : `main` reste la version stable Synology.

```
saas-staging ──(merge --no-ff, après validation)──▶ saas-production
     │                                                     │
     ▼ Coolify staging                                     ▼ Coolify production
 staging.gedify.example.com                          app.gedify.example.com

 main ──▶ gedify.azserver.fr + Docker Synology   (INDÉPENDANT, non impacté)
```

---

## 10. Ne pas impacter Docker Synology

- Toutes les nouveautés SaaS ont des **valeurs par défaut sûres** : si
  `APP_ENV`, `NEXT_PUBLIC_APP_ENV`, `REDIS_URL`, `STORAGE_*` sont absentes,
  le comportement est identique à aujourd'hui.
- Le **bandeau staging ne s'affiche jamais** sans `NEXT_PUBLIC_APP_ENV=staging`.
- Le **Dockerfile et `docker-entrypoint.sh` ne sont pas modifiés** : Synology
  continue de builder via son image habituelle.
- `GEDIFY_STORAGE_MODE` par défaut reste `json` → aucun changement de stockage
  imposé aux installations existantes.
- **Aucune modification du schéma Prisma / base** dans cette préparation.

---

## Annexe — Outils de vérification dans l'app

- **Bandeau d'environnement** : `src/components/env/EnvironmentBanner.tsx`
  (visible uniquement en staging, non bloquant).
- **Diagnostic** : page `/admin/system/environment` (réservée admin) — affiche
  l'état de configuration **sans aucun secret**.
- **Lecture centralisée** : `src/lib/config/environment.ts` (helpers `getAppEnv`,
  `getStorageDriver`, `getEnvironmentDiagnostics`…).
