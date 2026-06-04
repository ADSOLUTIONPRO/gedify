# Gedify pour macOS

Application macOS (Electron) qui enveloppe Gedify, avec **un seul binaire** capable de
fonctionner dans **3 modes**, choisis au premier lancement :

| Mode | `runtimeMode` | Description |
|------|---------------|-------------|
| **A — Serveur Gedify existant** | `remote_gedify` | Client : charge un serveur Gedify en ligne (ex. `https://doc.azserver.fr`). Aucune donnée métier en local. |
| **B — Gedify local léger** | `local_gedify` | Données Gedify locales sur le Mac, connectées à un **Paperless existant**. |
| **C — Gedify Local complète** | `local_full` | Gedify **+ Paperless local** (Docker Compose : PostgreSQL, Redis, Tika, Gotenberg). Autonome. |

> ✅ Les **3 modes lancent désormais Gedify** :
> - **Mode A** : charge le serveur Gedify distant.
> - **Modes B/C** : démarrent le **moteur Gedify local embarqué** (build Next.js standalone
>   exécuté via Electron-as-Node sur `:3120`, **auth locale désactivée** `GEDIFY_LOCAL_NO_AUTH=1`),
>   données dans `~/Library/Application Support/Gedify/data`.
> - **Mode C** : installe **Paperless local** (Docker Compose) + crée l'admin + **récupère le
>   token automatiquement**. Nécessite **Docker Desktop**.
>
> Le moteur local est bundlé via `scripts/build-runtime.sh` (≈110 Mo, gitignoré). Rien n'est destructif.

L'app web reste intacte : tout est **isolé dans `apps-devices/macos/`** (exclu du `tsconfig`
et de l'ESLint racine).

---

## Prérequis

- macOS (Intel ou Apple Silicon)
- Node.js 18+ et npm (pour builder l'app)
- **Mode C uniquement** : Docker Desktop installé et lancé

## Architecture

```
apps-devices/macos/
├── electron/            # process principal (TS) : main, preload, config (Keychain), tests, stack
├── renderer/            # UI sans framework : onboarding + réglages, thème Gedify partagé (theme.css)
├── local-stack/         # Paperless local : docker-compose + .env + scripts (install/start/stop/reset/status)
├── build/               # entitlements macOS
├── scripts/             # build-macos / package-pkg / make-icns / notarize
└── package.json         # electron-builder (cible .pkg/.dmg universal)
```

Principes (cf. cahier des charges) :
- **Pas de duplication de Gedify** : le mode A réutilise *tel quel* le Gedify web (chargement d'URL).
- **Pas de Coolify en dur** : seules des variables génériques (`PAPERLESS_URL`, `GEDIFY_API_URL`, `DATA_DIR`…).
- **Le spécifique macOS** se limite à : fenêtres, menu natif, Keychain, packaging `.pkg`, stockage local, pilotage Docker.
- **Sécurité** : la fenêtre qui charge un site distant **n'expose pas** le pont privilégié `window.gedify` ; secrets chiffrés via `safeStorage` (Keychain) ; HTTP toléré pour le réseau local seulement.

## Lancer en développement

```bash
cd apps-devices/macos
npm install
npm run dev          # compile le TS puis lance Electron
```

## Générer l'installeur `.pkg`

```bash
cd apps-devices/macos
npm run make:icns    # génère electron/assets/Gedify.icns depuis public/gedify-icon.png
npm run pkg          # → dist/Gedify-<version>.pkg  (installe dans /Applications/Gedify.app)
npm run dmg          # variante .dmg
```

Notarisation Apple (optionnelle) :
```bash
APPLE_ID=… APPLE_TEAM_ID=… APPLE_APP_SPECIFIC_PASSWORD=… npm run notarize
```

Depuis la racine du projet (raccourcis) :
```bash
npm run build:macos     # = apps-devices/macos build
npm run package:macos    # = apps-devices/macos pkg
```

## Mode C — Paperless local (Docker)

L'écran « Installer Gedify Local complète » :
1. vérifie Docker ; 2. installe le stack (`install-local-stack.sh` : dossiers + `.env` + secrets générés + `docker compose pull`) ; 3. démarre (`start-local-stack.sh`).

Services (seul le webserver est exposé sur `127.0.0.1:8010`) :
```
webserver (Paperless)  · postgres · redis · gotenberg · tika
```
Ports : Gedify local `3120`, Paperless local `8010`. PostgreSQL/Redis/Tika/Gotenberg restent internes.

Création du compte Paperless : ouvrir **http://localhost:8010**, créer l'admin, générer un token API
(à coller dans Gedify — automatisation prévue ultérieurement).

Gestion via **Réglages / Diagnostics** (menu Gedify → ⌘,) : démarrer/arrêter/état/réinitialiser, ouvrir Paperless, ouvrir le dossier de données.

## Où sont stockées les données locales

Tout sous **`~/Library/Application Support/Gedify/`** :
```
config.json          # configuration (sans secret en clair)
secrets.bin.json     # tokens chiffrés (Keychain via safeStorage)
data/ database/ cache/ logs/
paperless/{data,media,export,consume}   postgres/   redis/   (mode C)
```
Rien n'est stocké dans `/Applications/Gedify.app`.

## Réinitialiser / sauvegarder

- **Changer de mode / serveur** : menu Gedify → « Changer de mode / serveur » (ne supprime aucune donnée).
- **Réinitialiser la configuration** : Réglages → zone sensible (conserve données + documents).
- **Réinitialiser le stack local** : `reset-local-stack.sh` supprime les conteneurs ; ajouter `WIPE_DATA=1` pour effacer AUSSI les données (destructif, confirmation requise).
- **Sauvegarde** : copier le dossier `~/Library/Application Support/Gedify/`.

## Limites de cette première version

- Modes B/C : runtime Gedify local non encore embarqué (écran de gestion en attendant) ; token Paperless local à coller manuellement.
- Pas de signature/notarisation par défaut (Gatekeeper peut avertir tant que le `.pkg` n'est pas notarisé).
- Cache hors-ligne minimal.

---

## Synchronisation avec l'app Gedify principale

**Partagé** (ne pas dupliquer) :
- En **mode A**, l'UI EST le Gedify web : toute modif web (composants, styles, pages, IA, Documents, Finances, Fiche IA, services Paperless) est visible dans l'app macOS **après redéploiement** du serveur, sans rebuild de l'app macOS.
- Les **tokens de thème** (`renderer/theme.css`) sont un miroir de `src/app/globals.css` : à resynchroniser si la charte change.

**Spécifique macOS** : `electron/`, menu natif, `.icns`, packaging, Keychain, pilotage Docker.

**Quand je modifie le web**, vérifier l'impact macOS :
- Modif **UI/style/page/logique** côté serveur → **mode A : rien à faire** (rebuild serveur suffit).
- Modif de la **charte (tokens)** → mettre à jour `renderer/theme.css`.
- Évolution des **modes B/C** (runtime local embarqué) → rebuild de l'app macOS : `npm run pkg`.

**Tester que l'app macOS reprend les changements** (mode A) : redéployer le serveur, relancer l'app — l'interface chargée reflète la nouvelle version.
