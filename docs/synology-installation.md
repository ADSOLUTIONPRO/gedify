# Installer Gedify sur Synology (Docker)

Gedify tourne dans **un seul conteneur** avec **un seul volume** de données.
Aucun PostgreSQL requis : toutes les données (métadonnées, fichiers, miniatures,
OCR, budget…) vivent dans le volume `/volume1/docker/gedify/data`.

> **À propos de « SQLite »** — Un backend SQLite dédié est prévu. Aujourd'hui, le
> mode autonome stocke les données en **fichiers** (JSON + binaires) dans le
> volume. Le résultat pratique est identique : 1 conteneur, 1 volume persistant,
> zéro base externe. Le fichier `gedify.sqlite` n'est pas encore créé ; la variable
> `DATABASE_URL=file:…` est réservée pour plus tard et sans effet aujourd'hui.

---

## 1. Pré-requis

- Synology DSM 7.2+ avec **Container Manager** (ou Docker) installé.
- ~2 Go de RAM libres, ~3 Go de disque pour l'image + vos documents.
- Accès SSH au NAS (recommandé) **ou** l'éditeur de projet de Container Manager.
- Une clé **OpenAI** si vous voulez l'analyse IA (facultatif).

## 2. Créer le dossier de données

Via **File Station** (ou SSH), créez :

```
/volume1/docker/gedify/data
```

C'est l'unique dossier à sauvegarder. Il contiendra automatiquement :

```
/volume1/docker/gedify/data/
├── engine/            (métadonnées documents, compteurs, tâches)
├── files/
│   ├── originals/     (fichiers importés — source de vérité)
│   ├── thumbnails/    (miniatures)
│   ├── previews/      (aperçus)
│   └── pages/         (pages PDF rendues)
├── ai/                (analyses IA)
├── mail-connector/    (comptes mail, chiffrés)
├── backups/
├── logs/
└── tmp/
```

## 3. Récupérer le projet

Copiez le dépôt (ou au minimum le dossier `apps-devices/nopp`) sur le NAS, par
exemple dans `/volume1/docker/gedify/app`. Le `Dockerfile` et le dossier
`deploy/synology/` doivent être présents.

## 4. Générer les secrets

Gedify a besoin de 3 secrets aléatoires (32 caractères minimum). En SSH :

```bash
openssl rand -hex 24   # AUTH_SECRET
openssl rand -hex 24   # CONNECTOR_SECRET_KEY
openssl rand -hex 24   # MAIL_CONNECTOR_KEY
```

Reportez chaque valeur dans le fichier compose (section `environment`).
**Ne partagez jamais ces secrets ni votre clé OpenAI.**

## 5. Configurer le compose

Ouvrez `deploy/synology/docker-compose.sqlite.yml` et renseignez :

- `AUTH_SECRET`, `CONNECTOR_SECRET_KEY`, `MAIL_CONNECTOR_KEY` (étape 4) ;
- `OPENAI_API_KEY` **et** `AI_CLOUD_API_KEY` (même clé) si vous utilisez l'IA ;
- le port hôte `3210` si déjà utilisé (gauche du mapping `"3210:3200"`).

Le volume `- /volume1/docker/gedify/data:/app/.data` correspond à l'étape 2.

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

Méthodes :

- **Hyper Backup** vers un disque externe / le cloud (planifié) ;
- ou une copie à froid (conteneur arrêté) :
  ```bash
  sudo docker compose -f docker-compose.sqlite.yml stop
  cp -a /volume1/docker/gedify/data /volume1/backups/gedify-$(date +%F)
  sudo docker compose -f docker-compose.sqlite.yml start
  ```

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

## 13. Variante PostgreSQL (avancé, facultatif)

Pour un usage avancé, `docker-compose.postgres.yml` ajoute un conteneur
PostgreSQL. Les **fichiers** restent dans le volume ; seules les métadonnées vont
en base. Réservé aux utilisateurs avertis — le mode autonome SQLite/local suffit
à la grande majorité des installations Synology.

---

### Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche / 502 au démarrage | build en cours | patienter 1-2 min, voir les logs du conteneur |
| `chown … impossible` dans les logs | volume mal monté | vérifier que `/volume1/docker/gedify/data` existe et est accessible |
| Pas de vignettes | binaires natifs | l'image embarque sharp/canvas musl ; reconstruire avec `--build` |
| IA inactive | clé absente | renseigner `OPENAI_API_KEY` + `AI_CLOUD_API_KEY`, redémarrer |
| Cookie non conservé en HTTPS | `COOKIE_SECURE` | mettre `"true"` derrière le reverse proxy HTTPS |

Les clés API et secrets ne sont **jamais** écrits dans les logs.
