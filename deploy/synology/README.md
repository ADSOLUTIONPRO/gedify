# Installation GEDify Synology SQLite

Version **autonome** pour Synology Container Manager : GEDify + SQLite + IA locale
**Ollama** + édition Office **ONLYOFFICE Docs**. Les **secrets** et la **clé JWT**
ONLYOFFICE sont **générés automatiquement** par un service `init-secrets` intégré
au compose.

> ✅ **Plus besoin de créer `onlyoffice.env` à la main, ni de SSH.**
> Le service `init-secrets` crée `secrets.env` + `onlyoffice.env` dans le volume
> **au démarrage**, AVANT GEDify et ONLYOFFICE. Le compose ne contient plus
> d'`env_file` obligatoire → Container Manager peut importer le YAML directement.

---

## Option A — Installation 100 % Container Manager (recommandée)

**Aucune commande SSH.** Tout est généré automatiquement au premier démarrage.

1. **Créez les dossiers** du volume (File Station ou SSH), par ex. :
   `/volume5/docker/gedify` (sous-dossiers `data`, `ollama`, `onlyoffice` créés au besoin).
2. **Adaptez 2 valeurs** dans `deploy/synology/docker-compose.sqlite.v2.yml`
   (valeurs en clair, pas d'interpolation → fiable dans Container Manager) :
   - le volume `/volume5/docker/gedify` → **votre** volume ;
   - l'IP `192.168.1.17` → l'**IP réelle du NAS**, sur les deux lignes
     `ONLYOFFICE_DOCUMENT_SERVER_URL` (`:8082`) et `GEDIFY_PUBLIC_URL` (`:3210`).
3. **Container Manager → Projet → Créer** → importez (ou collez)
   `docker-compose.sqlite.v2.yml` → **Lancez**.

Au démarrage, dans l'ordre :
`init-secrets` (crée `secrets.env` + `onlyoffice.env`) → `ollama` →
`ollama-init` (télécharge `qwen3:4b`) → `onlyoffice` (démarre avec la clé JWT
générée) → `gedify` (récupère la **même** `ONLYOFFICE_JWT_SECRET`).

> `GEDIFY_PUBLIC_URL` sert aussi à ONLYOFFICE pour télécharger/sauvegarder les
> documents : elle DOIT pointer vers l'IP réelle du NAS (jamais `localhost`).

## Fichiers générés automatiquement

Dans `/volume5/docker/gedify/data/` (créés par `init-secrets`) :

| Fichier | Contenu |
|---|---|
| `secrets.env` | secrets internes GEDify (`AUTH_SECRET`, `JWT_SECRET`, …, `ONLYOFFICE_JWT_SECRET`) |
| `onlyoffice.env` | `ONLYOFFICE_JWT_SECRET` + `JWT_SECRET` (même valeur) + `JWT_ENABLED` + `JWT_HEADER` |

- 🔒 **Ne partagez JAMAIS** ces fichiers (clé JWT, clés de session/chiffrement).
- ⚠️ **Ne les supprimez pas** sauf réinitialisation complète volontaire (sinon
  sessions invalidées + erreurs « Invalid token » côté ONLYOFFICE).
- La clé ONLYOFFICE existante n'est **jamais écrasée** (idempotent).

## Option B — Pré-initialisation manuelle (avancé, facultatif)

Si vous préférez générer les fichiers **avant** l'import (ou auditer la clé), le
script hôte `init-host.sh` fait la même chose en SSH :

```bash
export SYNOLOGY_DOCKER_ROOT=/volume5/docker/gedify   # ou /volume1/...
sh deploy/synology/init-host.sh
```

Il crée `data/onlyoffice.env` + `data/secrets.env` (clé JWT partagée, `chmod 600`,
jamais affichée). C'est **optionnel** avec l'Option A. Vérifier ensuite :

```bash
cat "$SYNOLOGY_DOCKER_ROOT/data/onlyoffice.env"
```

## Services inclus

| Service | Conteneur | Rôle |
|---|---|---|
| GEDify | `gedify` | Application (Next.js standalone) |
| SQLite | *(intégré à GEDify)* | Base `…/data/gedify.sqlite` |
| ONLYOFFICE Docs | `gedify-onlyoffice` | Édition Office en ligne (.docx) |
| Ollama | `gedify-ollama` (+ `gedify-ollama-init`) | IA locale (modèle `qwen3:4b`) |

## Ports

| Service | Port | Exposition |
|---|---|---|
| GEDify | **3210** | publié (réseau local) |
| ONLYOFFICE | **8082** | publié (réseau local) |
| Ollama | 11434 | **non publié** (interne) sauf choix contraire |

## Tester ONLYOFFICE

Dans un navigateur du réseau local :

```
http://IP_DU_NAS:8082/healthcheck                          → true
http://IP_DU_NAS:8082/web-apps/apps/api/documents/api.js   → un script JavaScript
```

> Le **1er démarrage** d'ONLYOFFICE prend ~1 min (l'image est volumineuse) avant
> que `/healthcheck` renvoie `true`.

## Tester GEDify

```
http://IP_DU_NAS:3210
```

Puis : **Office → Rédaction → Nouveau courrier** → l'éditeur ONLYOFFICE doit
s'afficher dans GEDify.

## Dépannage

**`Failed to load onlyoffice.env`** — **ne devrait plus arriver** : le compose v2
n'utilise plus d'`env_file`. Si vous le voyez encore, vous importez un ancien
compose → réimportez `docker-compose.sqlite.v2.yml` à jour.

**ONLYOFFICE ne démarre pas / pas de clé JWT**
- vérifiez les logs d'init : `docker logs gedify-init-secrets` (doit afficher
  « Secrets Synology prets. ») ;
- vérifiez que le fichier a bien été généré :
  `ls -lah /volume5/docker/gedify/data/onlyoffice.env` ;
- vérifiez `docker logs gedify-onlyoffice` (le script charge la clé puis lance
  `/app/ds/run-document-server.sh`).

**`Invalid token`** (côté ONLYOFFICE)
- `ONLYOFFICE_JWT_SECRET` et `JWT_SECRET` doivent être **identiques** :
  `cat "$SYNOLOGY_DOCKER_ROOT/data/onlyoffice.env"`.
- ne régénérez pas `onlyoffice.env` après la 1ʳᵉ installation (sauf rotation
  volontaire — voir ci-dessous) ; après rotation, **redémarrez** `gedify` ET
  `gedify-onlyoffice`.

**`The "MODEL" variable is not set`**
- corrigé : le YAML n'utilise plus `${MODEL}` (le modèle est évalué dans le
  conteneur via `$${OLLAMA_MODEL:-qwen3:4b}`). Réimportez le compose à jour.

**`Échec du chargement du script ONLYOFFICE`** (dans GEDify)
- testez `http://IP_DU_NAS:8082/web-apps/apps/api/documents/api.js` ;
- vérifiez `ONLYOFFICE_DOCUMENT_SERVER_URL` (bonne IP du NAS, bon port `8082`) ;
- la CSP de GEDify autorise dynamiquement l'origine de
  `ONLYOFFICE_DOCUMENT_SERVER_URL` — vérifiez la console du navigateur (un
  message « Refused to load … Content Security Policy » pointe la cause).

Commandes utiles :

```bash
docker logs gedify-onlyoffice --tail=100
docker logs gedify --tail=100
docker exec -it gedify-onlyoffice bash
curl -fsS http://localhost/healthcheck      # depuis le conteneur ONLYOFFICE
```

## Régénérer la clé ONLYOFFICE (si compromise)

Par défaut, `init-host.sh` **ne régénère jamais** une clé existante. Pour forcer
une rotation volontaire :

```bash
FORCE_ROTATE_ONLYOFFICE_SECRET=1 SYNOLOGY_DOCKER_ROOT=/volume5/docker/gedify \
  sh deploy/synology/init-host.sh
```

Cela génère une nouvelle clé, met à jour `onlyoffice.env` **et** `secrets.env`
(en conservant les autres secrets), puis demande de **redémarrer** `gedify` et
`gedify-onlyoffice`.

## Changer l'adresse IP du NAS

Dans `docker-compose.sqlite.v2.yml`, remplacez l'IP `192.168.1.17` sur les deux
lignes `ONLYOFFICE_DOCUMENT_SERVER_URL` (`:8082`) et `GEDIFY_PUBLIC_URL` (`:3210`),
puis relancez le projet (`docker compose -f docker-compose.sqlite.v2.yml up -d`).

## Publier l'image GEDify (mainteneur)

Le compose v2 utilise une **image préconstruite** (pas de build sur le NAS) :

```yaml
image: ${GEDIFY_IMAGE:-ghcr.io/adsolutionpro/gedify:latest}
```

Cette image est construite et publiée automatiquement sur **GitHub Container
Registry (GHCR)** par le workflow [`.github/workflows/docker-publish.yml`](../../.github/workflows/docker-publish.yml).

**Procédure :**

1. **Poussez sur `main`** (ou créez un tag `v*`) dans le dépôt GitHub.
2. **Attendez GitHub Actions** : onglet *Actions* → workflow « Publier l'image
   GEDify (GHCR) » doit passer au vert (le 1er build peut prendre 10–20 min).
3. **Vérifiez l'image** : page GitHub du dépôt → *Packages* → `gedify`. Tags
   produits : `latest` (sur main), `sha-xxxxxxx` (par commit), `vX.Y.Z` (sur tag).
4. **Rendez le package PUBLIC** (recommandé pour Synology sans login) :
   Packages → `gedify` → *Package settings* → *Change visibility* → **Public**.
5. (Sinon, package **privé**) connectez Container Manager / Docker à GHCR sur le NAS :
   ```bash
   echo "<TOKEN_GITHUB_classique_avec_read:packages>" | \
     docker login ghcr.io -u <votre_user_github> --password-stdin
   ```

Une fois l'image disponible, sur le NAS :

```bash
# (image préconstruite : PAS de --build)
docker compose -f docker-compose.sqlite.v2.yml pull
docker compose -f docker-compose.sqlite.v2.yml up -d
```

> Owner en MINUSCULES : GHCR exige des noms en minuscules. Le workflow met
> automatiquement `github.repository_owner` en minuscules → `ghcr.io/adsolutionpro/gedify`.
> Si votre owner GitHub diffère, surchargez `GEDIFY_IMAGE` (variable d'environnement
> ou `.env` voisin) avec le nom exact, ex. `GEDIFY_IMAGE=ghcr.io/monorg/gedify:latest`.

### Dépannage du pull GHCR

| Erreur Container Manager | Cause probable | Solution |
|---|---|---|
| `manifest unknown` / `not found` | image/tag pas encore publiés | attendre la fin du workflow Actions ; vérifier le tag (`latest`) dans *Packages* |
| `denied` / `pull access denied` | package **privé** | rendre le package **public** (étape 4) **ou** `docker login ghcr.io` sur le NAS (étape 5) |
| `unauthorized` | token invalide/expiré | recréer un *Personal Access Token (classic)* avec `read:packages`, refaire `docker login` |
| mauvais nom d'image | owner/casse incorrects | l'image est `ghcr.io/<owner-minuscule>/gedify` ; ajustez `GEDIFY_IMAGE` si besoin |
| `no matching manifest for linux/arm64` | NAS ARM | le workflow publie `linux/amd64` (Container Manager = x86_64) ; pour ARM, ajoutez `linux/arm64` aux `platforms` du workflow |

Vérifier manuellement le pull depuis le NAS :

```bash
docker pull ghcr.io/adsolutionpro/gedify:latest   # doit réussir si public/loggé
```
