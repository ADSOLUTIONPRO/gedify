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

## Où exécuter — DANS le conteneur Coolify (recommandé)

Les scripts sont **compilés et committés** dans `scripts/gedify-*.mjs` (ESM
autonome, sans `tsx` ni binaire natif) et embarqués dans l'image runtime avec le
client Prisma et le schéma SQL. Le `package.json` du conteneur est remplacé par
le vrai (la sortie standalone de Next en livre un vide). On fait donc tout
directement sur le serveur, sans copier les données ailleurs :

```bash
# Sur le serveur :
docker ps --format "table {{.Names}}\t{{.Image}}" | grep -i ged
docker exec -it <CONTENEUR_GEDIFY> sh

# Dans le conteneur (cwd = /app, volume monté sur /app/.data) :
npm run gedify:storage:inspect        # = node dist-scripts/gedify-storage-inspect.mjs
npm run gedify:migrate-json:dry-run   # vérifier le rapport
npm run gedify:backup-json
npm run gedify:db:push                # crée les tables via prisma/sql/init.sql + pg
npm run gedify:migrate-json           # migration réelle
```

`db:push` n'utilise PAS le CLI Prisma (absent du runtime) : il applique
`prisma/sql/init.sql` (DDL idempotent `IF NOT EXISTS`) via `pg`.

> Le schéma SQL `prisma/sql/init.sql` est généré depuis `prisma/schema.prisma`.
> Après toute modification du schéma : `npm run prisma:sql` (puis commit).

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
