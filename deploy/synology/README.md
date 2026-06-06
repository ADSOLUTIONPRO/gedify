# Installation GEDify Synology SQLite

Version **autonome** pour Synology Container Manager : GEDify + SQLite + IA locale
**Ollama** + édition Office **ONLYOFFICE Docs**, secrets et clé JWT **générés
automatiquement**. Une seule chose à faire avant l'import : lancer le script
d'initialisation hôte.

> ⚠️ **Pourquoi un script d'init hôte ?**
> Container Manager (docker compose) lit `env_file` **au moment du parsing**. Si
> `onlyoffice.env` n'existe pas encore, la création du projet échoue avec
> `Failed to load …/data/onlyoffice.env: no such file or directory` — **avant**
> qu'un quelconque conteneur n'ait pu le créer. Le script `init-host.sh` crée
> donc les dossiers + les fichiers d'environnement **côté NAS**, en amont.

---

## 1. Préparation des dossiers et secrets (OBLIGATOIRE avant l'import)

En SSH sur le NAS, depuis le dossier du dépôt (`apps-devices/nopp`) :

**Cas standard (volume1) :**

```bash
export SYNOLOGY_DOCKER_ROOT=/volume1/docker/gedify
sh deploy/synology/init-host.sh
```

**Cas volume5 (exemple) :**

```bash
export SYNOLOGY_DOCKER_ROOT=/volume5/docker/gedify
sh deploy/synology/init-host.sh
```

Le script (idempotent — relançable sans risque) :

- crée `…/data`, `…/onlyoffice/{logs,data,lib,db}`, `…/ollama` ;
- crée `…/data/onlyoffice.env` (clé JWT ONLYOFFICE) **s'il est absent** ;
- crée/complète `…/data/secrets.env` (secrets internes GEDify) ;
- garde **exactement la même** clé JWT côté GEDify et côté ONLYOFFICE ;
- écrit `deploy/synology/.env` (pointeur `SYNOLOGY_DOCKER_ROOT`) pour que les
  chemins du compose pointent vers le bon volume ;
- met les fichiers en `chmod 600` et **n'affiche jamais la clé en clair**.

## 2. Vérifier les fichiers créés

```bash
ls -lah "$SYNOLOGY_DOCKER_ROOT/data"
cat "$SYNOLOGY_DOCKER_ROOT/data/onlyoffice.env"
```

`onlyoffice.env` doit contenir :

```
ONLYOFFICE_JWT_SECRET=<clé>
JWT_SECRET=<même clé>
JWT_ENABLED=true
JWT_HEADER=Authorization
```

> 🔒 **Ne partagez JAMAIS** le contenu de `onlyoffice.env` ni de `secrets.env` :
> ce sont des secrets (clé JWT, clés de session/chiffrement).

## 3. Importer dans Container Manager

1. Ouvrez **Container Manager → Projet → Créer**.
2. Source : sélectionnez le fichier `deploy/synology/docker-compose.sqlite.yml`
   du dépôt (de préférence par **chemin**, pour que le `deploy/synology/.env`
   voisin soit lu automatiquement).
3. Vérifiez que **`SYNOLOGY_DOCKER_ROOT`** correspond au bon volume :
   - si vous avez importé par chemin, le `.env` voisin s'en charge ;
   - sinon (copier-coller du YAML), ajoutez la variable d'environnement
     `SYNOLOGY_DOCKER_ROOT=/volume5/docker/gedify` dans Container Manager
     (et `GEDIFY_SYNOLOGY_HOST=<IP_DU_NAS>` pour l'éditeur — voir plus bas).
4. **Lancez** le projet.

> Réglez aussi `GEDIFY_SYNOLOGY_HOST` sur l'**IP réelle du NAS** (défaut
> `192.168.1.17`), via `deploy/synology/.env` ou la variable d'environnement de
> Container Manager. Elle construit `GEDIFY_PUBLIC_URL` (`:3210`) et
> `ONLYOFFICE_DOCUMENT_SERVER_URL` (`:8082`).

## 4. Services inclus

| Service | Conteneur | Rôle |
|---|---|---|
| GEDify | `gedify` | Application (Next.js standalone) |
| SQLite | *(intégré à GEDify)* | Base `…/data/gedify.sqlite` |
| ONLYOFFICE Docs | `gedify-onlyoffice` | Édition Office en ligne (.docx) |
| Ollama | `gedify-ollama` (+ `gedify-ollama-init`) | IA locale (modèle `qwen3:4b`) |

## 5. Ports

| Service | Port | Exposition |
|---|---|---|
| GEDify | **3210** | publié (réseau local) |
| ONLYOFFICE | **8082** | publié (réseau local) |
| Ollama | 11434 | **non publié** (interne) sauf choix contraire |

## 6. Tester ONLYOFFICE

Dans un navigateur du réseau local :

```
http://IP_DU_NAS:8082/healthcheck                          → true
http://IP_DU_NAS:8082/web-apps/apps/api/documents/api.js   → un script JavaScript
```

> Le **1er démarrage** d'ONLYOFFICE prend ~1 min (l'image est volumineuse) avant
> que `/healthcheck` renvoie `true`.

## 7. Tester GEDify

```
http://IP_DU_NAS:3210
```

Puis : **Office → Rédaction → Nouveau courrier** → l'éditeur ONLYOFFICE doit
s'afficher dans GEDify.

## 8. Dépannage

**`Failed to load onlyoffice.env`** (échec à la création du projet)
- `init-host.sh` n'a pas été lancé → relancez-le (section 1).
- mauvais volume : vérifiez `SYNOLOGY_DOCKER_ROOT` (`/volume1` vs `/volume5`).
- vérifiez : `ls -lah "$SYNOLOGY_DOCKER_ROOT/data/onlyoffice.env"`.

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

Modifiez **`GEDIFY_SYNOLOGY_HOST`** (et, si besoin, `SYNOLOGY_DOCKER_ROOT`) dans
`deploy/synology/.env` ou dans Container Manager, puis relancez le projet. Cela
met à jour automatiquement `GEDIFY_PUBLIC_URL` et `ONLYOFFICE_DOCUMENT_SERVER_URL`.
