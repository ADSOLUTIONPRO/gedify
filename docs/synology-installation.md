# Installer Gedify sur Synology (Docker)

Gedify tourne dans **un seul conteneur** avec **un seul volume** de données.
Aucun PostgreSQL requis : les **métadonnées** (documents, tags, correspondants,
budget, mails…) vivent dans un **vrai fichier SQLite** `gedify.sqlite`, et les
**fichiers** (originaux, miniatures, OCR…) à côté — le tout dans le volume unique
`/volume1/docker/gedify/data`.

> **Stockage SQLite réel** — En mode `GEDIFY_STORAGE_MODE=sqlite`, Gedify crée et
> utilise réellement `/app/.data/gedify.sqlite` (journalisation WAL, clés
> étrangères activées). Au premier lancement, le fichier, les tables et les
> migrations sont créés automatiquement ; **aucune base existante n'est jamais
> écrasée**. Avec `ENABLE_JSON_FALLBACK=false` (défaut Synology), si SQLite était
> indisponible vous auriez une **erreur claire** plutôt qu'un stockage fantôme.
> La Santé GED affiche l'état exact (SQLite OK, WAL, clés étrangères, taille…).

> **Tout est autonome** — La version Synology SQLite installe **Ollama** (IA
> locale) **et ONLYOFFICE Docs** (édition Office en ligne) automatiquement :
> aucune clé OpenAI, aucune clé JWT à créer. Les **secrets internes** (dont la
> clé ONLYOFFICE) sont **générés automatiquement** au premier démarrage. Vous
> n'avez rien à saisir : il suffit de lancer le compose. Voir §13 (Ollama),
> §14 (secrets) et §15 (ONLYOFFICE).

---

## 1. Pré-requis

- Synology DSM 7.2+ avec **Container Manager** (ou Docker) installé.
- **RAM** : ~3 Go libres minimum (l'IA locale Ollama + le modèle `qwen3:4b`
  consomment ~3–4 Go quand l'IA travaille). Sur un petit NAS, préférez le modèle
  plus léger `llama3.2:3b` (voir §13).
- ~8 Go de disque : image + modèle IA (~2,5 Go) + vos documents.
- Accès SSH au NAS (recommandé) **ou** l'éditeur de projet de Container Manager.
- **Aucune clé OpenAI requise** : l'IA tourne en local (Ollama). Une vraie clé
  OpenAI reste possible en option (voir §13, « Revenir à OpenAI »).

## 2. Créer les dossiers de données

Via **File Station** (ou SSH), créez les dossiers :

```
/volume1/docker/gedify/data        (données Gedify : SQLite + fichiers + secrets)
/volume1/docker/gedify/ollama      (modèles IA Ollama, ~2,5 Go pour qwen3:4b)
/volume1/docker/gedify/onlyoffice  (données ONLYOFFICE Docs — créés au 1er run)
```

> Les sous-dossiers de `onlyoffice/` (`logs`, `data`, `lib`, `db`) sont créés
> automatiquement au premier lancement.

C'est l'unique dossier à sauvegarder. Il contiendra automatiquement :

```
/volume1/docker/gedify/data/
├── gedify.sqlite      (BASE SQLite : métadonnées, tags, budget, mails…)
├── gedify.sqlite-wal  (journal WAL — normal, ne pas supprimer à chaud)
├── gedify.sqlite-shm  (mémoire partagée WAL)
├── files/
│   ├── originals/     (fichiers importés — source de vérité)
│   ├── thumbnails/    (miniatures)
│   ├── previews/      (aperçus)
│   └── pages/         (pages PDF rendues)
├── ai/                (résultats IA — repris dans la base au besoin)
├── mail-connector/    (secrets mail chiffrés)
├── backups/
├── logs/
└── tmp/
```

> Les fichiers `engine/*.json` et autres `.json` ne sont créés que si vous avez
> migré depuis une ancienne installation (voir §14). En mode SQLite neuf, les
> métadonnées vivent directement dans `gedify.sqlite`.

## 3. Récupérer le projet

Copiez le dépôt (ou au minimum le dossier `apps-devices/nopp`) sur le NAS, par
exemple dans `/volume1/docker/gedify/app`. Le `Dockerfile` et le dossier
`deploy/synology/` doivent être présents.

## 4. Secrets : rien à faire

Les secrets internes (`AUTH_SECRET`, `CONNECTOR_SECRET_KEY`, `MAIL_CONNECTOR_KEY`
et autres) sont **générés automatiquement** au premier démarrage par le script
`deploy/synology/scripts/init-secrets.sh`, puis enregistrés dans
`/volume1/docker/gedify/data/secrets.env` (permissions `600`).

Vous n'avez **rien à saisir**. Détails et points de vigilance : voir §14.

## 5. Configurer le compose

Le fichier `deploy/synology/docker-compose.sqlite.yml` fonctionne **tel quel** :
IA locale Ollama activée par défaut, secrets auto-générés. En pratique, rien à
modifier. Ajustez seulement si besoin :

- le port hôte `3210` s'il est déjà utilisé (gauche du mapping `"3210:3200"`) ;
- le modèle IA via `OLLAMA_MODEL` (défaut `qwen3:4b`, voir §13) ;
- les chemins des volumes `/volume1/docker/gedify/data` et `/volume1/docker/gedify/ollama`
  (étape 2) si votre volume diffère.

Les deux volumes correspondent à l'étape 2. Aucune clé OpenAI à renseigner.

## 6. Premier lancement

### Option A — SSH (le plus simple)

```bash
cd /volume1/docker/gedify/app/apps-devices/nopp/deploy/synology
sudo docker compose -f docker-compose.sqlite.yml up -d --build
```

La première construction prend quelques minutes (téléchargement de Node, des
données OCR fra+eng, build Next). Les démarrages suivants sont immédiats.

### Option B — Container Manager (interface)

1. **Projet → Créer** ;
2. Source : « Créer docker-compose.yml » → collez le contenu de
   `docker-compose.sqlite.yml` ;
3. Renseignez les secrets ;
4. **Suivant → Terminé** : Container Manager construit puis démarre l'image.

## 7. Accès & première configuration

Ouvrez :

```
http://IP_DU_NAS:3210
```

Au **premier lancement**, Gedify crée la structure de données dans le volume puis
affiche l'écran d'**installation** : créez votre **compte administrateur**.
Aucune base existante n'est jamais écrasée, aucun document n'est supprimé.

Vérifiez la santé du service :

```
http://IP_DU_NAS:3210/api/health   → {"status":"ok","runtime":"docker", ...}
```

## 8. Reverse proxy HTTPS Synology (recommandé)

Pour un accès propre en HTTPS (`https://gedify.mon-nas.synology.me`) :

1. **Panneau de configuration → Portail de connexion → Avancé → Reverse Proxy** ;
2. Source : `https` / votre nom de domaine / port `443` ;
3. Destination : `http` / `localhost` / `3210` ;
4. Onglet **En-têtes personnalisés** → activez **WebSocket** ;
5. Dans le compose, passez `COOKIE_SECURE: "true"` puis redémarrez le conteneur.

## 9. Sauvegarde

Tout tient dans **un seul dossier**. Sauvegardez :

```
/volume1/docker/gedify/data
```

Le dossier contient la base `gedify.sqlite` (+ ses fichiers `-wal`/`-shm`) **et**
les fichiers (`files/`). Sauvegardez-le entier.

Méthodes :

- **Hyper Backup** vers un disque externe / le cloud (planifié) ;
- ou une copie à froid (conteneur arrêté — recommandé pour SQLite : l'arrêt
  ferme la base et replie le journal WAL dans `gedify.sqlite`) :
  ```bash
  sudo docker compose -f docker-compose.sqlite.yml stop
  cp -a /volume1/docker/gedify/data /volume1/backups/gedify-$(date +%F)
  sudo docker compose -f docker-compose.sqlite.yml start
  ```
- ou la **sauvegarde intégrée** (Administration → Sauvegarde) : l'archive ZIP
  inclut un snapshot de `gedify.sqlite` (après checkpoint WAL) + les fichiers.

## 10. Restauration

1. Arrêtez le conteneur ;
2. Remplacez le contenu de `/volume1/docker/gedify/data` par votre sauvegarde ;
3. Redémarrez. Gedify repart sur les mêmes données (aucune ré-initialisation).

## 11. Mise à jour

```bash
cd /volume1/docker/gedify/app/apps-devices/nopp/deploy/synology
git -C /volume1/docker/gedify/app pull        # récupérer la nouvelle version
sudo docker compose -f docker-compose.sqlite.yml up -d --build
```

Vos données dans le volume sont conservées.

## 12. Vérifier que les données persistent

Après import d'un document, redémarrez le conteneur :

```bash
sudo docker compose -f docker-compose.sqlite.yml restart
```

Le document, sa miniature et son analyse doivent toujours être présents (ils
sont sur le volume, pas dans le conteneur).

## 13. IA locale avec Ollama

La version Synology SQLite **installe Ollama automatiquement** (conteneur
`gedify-ollama`) et l'utilise comme moteur IA. **Aucune clé OpenAI n'est
nécessaire.** Tout reste sur le NAS : aucun document n'est envoyé à un service
externe.

**Au premier lancement**, le conteneur `gedify-ollama-init` télécharge le modèle
défini par `OLLAMA_MODEL` (par défaut `qwen3:4b`, ~2,5 Go). **Ce premier
démarrage peut être long** (quelques minutes selon votre connexion). Pendant ce
temps, Gedify fonctionne déjà ; seule l'analyse IA attend la fin du
téléchargement. Les fois suivantes, le modèle est déjà là (démarrage immédiat).

**Emplacements :**

- Modèles Ollama : `/volume1/docker/gedify/ollama`
- Données SQLite + fichiers : `/volume1/docker/gedify/data`

**Le port `11434` (Ollama) n'est jamais exposé** sur le NAS : Gedify le contacte
uniquement sur le réseau interne des conteneurs. Pas de GPU requis (CPU only).

### Choisir / changer le modèle

Modifiez `OLLAMA_MODEL` dans les **deux** services (`ollama-init` et `gedify`) du
compose, puis relancez `up -d`. Modèles recommandés :

| Modèle | Pour qui | Qualité | Ressources |
|---|---|---|---|
| `qwen3:4b` *(défaut)* | la plupart des NAS | bon compromis (analyse, résumé, extraction JSON, assistant) | ~3–4 Go RAM |
| `llama3.2:3b` | petit NAS | inférieure mais correcte | plus léger / plus rapide |
| `qwen3:8b` | NAS puissant (beaucoup de RAM) | meilleure | plus lourd |

Pour télécharger un autre modèle à chaud, sans changer le compose :

```bash
docker exec -it gedify-ollama ollama pull llama3.2:3b
# puis mettez OLLAMA_MODEL: "llama3.2:3b" dans le compose et relancez `up -d`
```

### Revenir à OpenAI (optionnel)

Dans le service `gedify` du compose, remplacez le bloc IA local par :

```yaml
      AI_PROVIDER: "openai"
      OPENAI_API_KEY: "sk-votre-vraie-cle"
      OPENAI_BASE_URL: "https://api.openai.com/v1"
      OPENAI_MODEL: "gpt-4o-mini"
```

Vous pouvez alors supprimer (ou laisser) les services `ollama` / `ollama-init`.
La fausse clé `ollama-local` n'est jamais traitée comme une vraie clé OpenAI.

## 14. Secrets internes automatiques

Un conteneur d'initialisation `gedify-init-secrets` (et, en repli,
`start-synology.sh`) exécute `init-secrets.sh` qui **génère les secrets internes**
manquants (`AUTH_SECRET`, `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`,
`INTERNAL_API_KEY`, `CRON_SECRET`, `CONNECTOR_SECRET_KEY`, `MAIL_CONNECTOR_KEY`,
**`ONLYOFFICE_JWT_SECRET`**) puis les charge avant de lancer l'application.

- **Emplacement** : `/volume1/docker/gedify/data/secrets.env` (permissions `600`).
  Un fichier dérivé `onlyoffice.env` (clé JWT uniquement) est lu par ONLYOFFICE.
- **Jamais committé** : `.data/`, `secrets.env` et `onlyoffice.env` sont ignorés par Git.
- **Idempotent** : un secret déjà présent n'est **jamais réécrit** → vos sessions,
  données chiffrées et l'appairage JWT ONLYOFFICE restent valides à chaque
  redémarrage/mise à jour.
- **Aucune clé externe** : `OPENAI_API_KEY` n'est **jamais** générée ici.
- **Ne supprimez pas ces fichiers** : les perdre invaliderait les sessions, les
  données chiffrées (tokens mail) et déclencherait des erreurs « Invalid token »
  côté ONLYOFFICE. Conservez-les dans vos sauvegardes (inclus dans `data/`).
  Suppression = réinitialisation volontaire des secrets.

## 15. ONLYOFFICE Docs intégré (édition Office en ligne)

La version Synology SQLite **inclut ONLYOFFICE Docs Community Edition** (conteneur
`gedify-onlyoffice`), installé automatiquement via Docker. Il permet l'**édition
en ligne** des documents Office (.docx) directement depuis Gedify (Office →
Nouveau courrier / rédaction).

- **Clé JWT générée automatiquement** (`ONLYOFFICE_JWT_SECRET`) — la **même**
  valeur sert côté Gedify et côté ONLYOFFICE (signature des échanges). Stockée
  dans `/volume1/docker/gedify/data/secrets.env`. **Ne jamais supprimer** ce
  fichier sauf réinitialisation complète.
- **Données ONLYOFFICE** : `/volume1/docker/gedify/onlyoffice`.
- **Port local par défaut** : `8082` (réseau local du NAS — **pas** exposé sur
  Internet par défaut).
- **Test de santé** : `http://IP_DU_SYNOLOGY:8082/healthcheck` → doit renvoyer `true`.
- **Script éditeur attendu** :
  `http://IP_DU_SYNOLOGY:8082/web-apps/apps/api/documents/api.js` → un script JS.
- **Gedify** doit être accessible sur `http://IP_DU_SYNOLOGY:3210`.

Variables clés (déjà posées par le compose) :

```
GEDIFY_PUBLIC_URL=http://IP_DU_SYNOLOGY:3210          # Gedify côté navigateur
ONLYOFFICE_DOCUMENT_SERVER_URL=http://IP_DU_SYNOLOGY:8082  # ONLYOFFICE côté navigateur
ONLYOFFICE_INTERNAL_URL=http://onlyoffice            # appels serveur → ONLYOFFICE
GEDIFY_INTERNAL_URL=http://gedify:3200               # ONLYOFFICE → Gedify (download/callback)
```

> **Premier lancement long** : l'image ONLYOFFICE est volumineuse et met ~1 min à
> devenir saine (`/healthcheck` = `true`). Patientez avant d'ouvrir l'éditeur.

## 16. Changer l'adresse IP du NAS

ONLYOFFICE et le navigateur doivent joindre Gedify par une **IP réelle** du NAS
(pas un nom Docker). Une seule variable pilote les deux URLs :
**`GEDIFY_SYNOLOGY_HOST`** (défaut `192.168.1.17`).

Le plus simple — créez un fichier `deploy/synology/.env` à côté du compose :

```
GEDIFY_SYNOLOGY_HOST=192.168.1.42
```

(ou éditez directement la valeur par défaut dans `docker-compose.sqlite.yml`).
Cela met à jour automatiquement :

- `GEDIFY_PUBLIC_URL=http://192.168.1.42:3210`
- `ONLYOFFICE_DOCUMENT_SERVER_URL=http://192.168.1.42:8082`

Puis relancez : `docker compose -f docker-compose.sqlite.yml up -d`.

> Derrière un reverse proxy HTTPS, mettez plutôt des URLs `https://…` complètes
> dans `GEDIFY_PUBLIC_URL` et `ONLYOFFICE_DOCUMENT_SERVER_URL`, et passez
> `COOKIE_SECURE: "true"`.

## 17. Variante PostgreSQL (avancé, facultatif)

Pour un usage avancé, `docker-compose.postgres.yml` ajoute un conteneur
PostgreSQL. Les **fichiers** restent dans le volume ; seules les métadonnées vont
en base. Réservé aux utilisateurs avertis — le mode SQLite autonome suffit à la
grande majorité des installations Synology.

## 18. Migration depuis une ancienne installation (JSON → SQLite)

Si vous aviez une installation Gedify qui stockait ses métadonnées en fichiers
JSON (anciens `engine/*.json`, `ai/`, `budget/`…), vous pouvez les importer dans
`gedify.sqlite` **sans rien perdre** (ids, hashes et structure conservés ; les
fichiers JSON sont laissés intacts ; idempotent — relançable sans créer de
doublon ; la base est sauvegardée avant écriture).

Depuis un shell **dans le conteneur** (Container Manager → Terminal, ou
`sudo docker exec -it gedify sh`) :

```bash
# 1) (facultatif) créer/vérifier la base + les tables
npm run gedify:sqlite:init

# 2) prévisualiser ce qui serait migré — n'écrit RIEN
npm run gedify:migrate-json-to-sqlite:dry-run

# 3) migrer pour de bon (sauvegarde automatique avant écriture)
npm run gedify:migrate-json-to-sqlite

# 4) inspecter l'état de la base (PRAGMA, tables, nombre de lignes)
npm run gedify:sqlite:inspect
```

La Santé GED (Administration → Santé) confirme : *Stockage : SQLite*, WAL actif,
clés étrangères actives, taille de la base et nombre de documents.

---

### Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche / 502 au démarrage | build en cours | patienter 1-2 min, voir les logs du conteneur |
| `chown … impossible` dans les logs | volume mal monté | vérifier que `/volume1/docker/gedify/data` existe et est accessible |
| Pas de vignettes | binaires natifs | l'image embarque sharp/canvas musl ; reconstruire avec `--build` |
| **IA lente / sans réponse au 1er lancement** | modèle Ollama en cours de téléchargement | patienter ; suivre `docker logs gedify-ollama-init` jusqu'à « Modèle Ollama prêt. » |
| **IA inactive (Ollama)** | serveur Ollama pas prêt | `docker logs gedify-ollama` ; vérifier le modèle : `docker exec -it gedify-ollama ollama list` |
| Cookie non conservé en HTTPS | `COOKIE_SECURE` | mettre `"true"` derrière le reverse proxy HTTPS |
| Santé GED : « SQLite indisponible » | `node:sqlite` non chargé | l'image fixe `NODE_OPTIONS=--experimental-sqlite` ; reconstruire avec `--build` |
| Base sur un partage réseau | I/O lentes / corruption WAL | garder `gedify.sqlite` sur un volume **local** du NAS, jamais un montage réseau |
| **« Échec du chargement du script ONLYOFFICE »** | URL/port/CSP | `ONLYOFFICE_DOCUMENT_SERVER_URL` faux, port `8082` injoignable, CSP, ou http/https incohérent — voir ci-dessous |
| **ONLYOFFICE « Invalid token »** | clé JWT différente | `ONLYOFFICE_JWT_SECRET` ≠ `JWT_SECRET` côté ONLYOFFICE, ou `secrets.env`/`onlyoffice.env` supprimé/régénéré → redémarrer `gedify-onlyoffice` |
| **ONLYOFFICE « Download failed »** | Gedify injoignable | `GEDIFY_INTERNAL_URL`/`GEDIFY_PUBLIC_URL` incorrect, mauvais port, ou reverse proxy mal réglé |

### Diagnostic ONLYOFFICE

```bash
# Logs
docker logs gedify-onlyoffice --tail=100
docker logs gedify --tail=100
docker logs gedify-init-secrets        # génération des secrets/clé JWT

# Santé + script éditeur (depuis un navigateur du réseau local)
#   http://IP_DU_SYNOLOGY:8082/healthcheck                          → true
#   http://IP_DU_SYNOLOGY:8082/web-apps/apps/api/documents/api.js   → script JS

# À l'intérieur du conteneur ONLYOFFICE
docker exec -it gedify-onlyoffice bash
curl -fsS http://localhost/healthcheck
```

Causes fréquentes du message « Échec du chargement du script ONLYOFFICE » :
`ONLYOFFICE_DOCUMENT_SERVER_URL` incorrect (mauvaise IP du NAS — voir §16), port
`8082` non accessible, CSP qui bloque (la CSP autorise dynamiquement l'origine de
`ONLYOFFICE_DOCUMENT_SERVER_URL`), ou mélange http/https. La console du navigateur
indique l'URL exacte et un éventuel « Refused to load … Content Security Policy ».

### Diagnostic IA locale (Ollama)

```bash
# Logs des conteneurs
docker logs gedify-ollama          # serveur IA
docker logs gedify-ollama-init     # téléchargement du modèle (1er lancement)
docker logs gedify                 # application Gedify

# Modèles installés
docker exec -it gedify-ollama ollama list

# Télécharger / changer de modèle
docker exec -it gedify-ollama ollama pull llama3.2:3b
```

Sur un petit NAS, si l'IA sature la RAM, passez à `llama3.2:3b` (§13). La Santé
GED (Administration → Santé) affiche le **Provider IA** actif (ex.
« Ollama local (qwen3:4b) »).

Les clés API et secrets ne sont **jamais** écrits dans les logs. La fausse clé
locale `ollama-local` n'est jamais comptée comme une vraie clé OpenAI.
