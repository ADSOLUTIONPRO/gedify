# Migration JSON → PostgreSQL (progressive, sans casser le JSON)

Gedify reste en **`GEDIFY_STORAGE_MODE=json`** (défaut). PostgreSQL est ajouté
**en parallèle** : on migre les données, on vérifie, puis seulement on bascule.
**Les JSON sources ne sont jamais supprimés.**

## Pré-requis

Variables (Coolify) :

```
GEDIFY_STORAGE_MODE=json          # on NE bascule pas encore
DATABASE_URL=postgresql://...     # base Postgres Coolify
DATA_DIR=/app/.data               # volume monté (source JSON)
ENABLE_JSON_FALLBACK=true
```

Prisma 7 : client TypeScript + driver `pg` (pas de moteur natif au runtime).
Le client est généré au build (`prisma generate`, inclus dans `npm run build`).

## Étapes

```bash
# 1. Inspecter les JSON existants (compte, fichiers invalides) — n'écrit rien
npm run gedify:storage:inspect

# 2. Sauvegarder tous les JSON (copie horodatée, ne supprime rien)
npm run gedify:backup-json

# 3. Créer les tables PostgreSQL (idempotent)
npm run gedify:db:push

# 4. DRY-RUN : montre ce qui serait migré, n'écrit RIEN en base
npm run gedify:migrate-json:dry-run

# 5. Migration réelle : backup auto + upsert idempotent (IDs conservés) +
#    rapport dans <DATA_DIR>/backups/migration-report-*.json
npm run gedify:migrate-json
```

Réexécutable sans danger (upsert idempotent). Tant que la migration n'est pas
vérifiée, on garde `GEDIFY_STORAGE_MODE=json`.

## Où exécuter

Les scripts ont besoin de Node + des dépendances (tsx, prisma, pg) **et** de
l'accès au volume JSON. Deux options :

- **Recommandé (sans toucher l'image)** : copier le dossier de données
  (`/data/gedify` côté serveur) sur une machine disposant du dépôt, pointer
  `DATA_DIR` dessus, `DATABASE_URL` sur la base Coolify, puis lancer les
  commandes ci-dessus. Lecture seule des JSON → aucun risque.
- **Dans le conteneur** : nécessite d'embarquer la chaîne d'outils
  (tsx/prisma/pg) dans l'image runtime — non fait pour l'instant (à wirer en
  étape suivante si souhaité).

## Bascule (plus tard, après vérification)

```
GEDIFY_STORAGE_MODE=postgres
```

La couche `src/lib/db/storage` sélectionne alors PostgreSQL (avec repli JSON si
`ENABLE_JSON_FALLBACK=true`). L'app continue d'utiliser le JSON tant que ce flag
n'est pas changé — **le comportement actuel n'est pas modifié**.

## Tables créées

`documents`, `document_files`, `document_versions`, `document_ocr`,
`document_ai_analyses`, `document_ai_suggestions`, `folders`, `folder_documents`,
`tags`, `document_tags`, `document_types`, `correspondents`,
`document_correspondents`, `budget_entries`, `budget_payments`, `mails`,
`mail_attachments`, `mail_document_links`, `reminders`, `tasks`, `signatures`,
`learned_templates`, `assistant_action_logs`, `activity_logs`, `settings`,
`users`, `counters`, `document_title_overrides`.

Chaque table conserve une colonne `raw`/`raw_payload`/`metadata` (JSON intégral
d'origine) → **migration sans perte**, même pour les champs non encore mappés.

Couverture ajoutée (avant migration réelle) : `users` (auth, IDs conservés,
contraintes uniques username/email, passwordHash jamais loggé), `counters`
(séquences d'ID — affichées dans le rapport), `ai/detected-infos.json` →
`document_ai_suggestions`, `document-title-overrides.json` →
`document_title_overrides`. `engine/tasks.json` reste **volontairement non
migré** (tâches de traitement moteur, éphémères).

Le rapport de migration liste les fichiers **non couverts** classés par
importance (`critique` / `important` / `mineur` / `éphémère` / `ignoré` /
`à examiner`), avec `dataLoss: false`.
