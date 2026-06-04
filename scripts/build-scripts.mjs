/* Compile les scripts de migration TS → JS autonome ESM (dist-scripts/),
   exécutable par `node` dans le conteneur runtime, SANS tsx ni dépendances dev.

   - bundle tout (pg, @prisma/adapter-pg, client Prisma généré, helpers) ;
   - garde `@prisma/client` EXTERNE (compilateur de requêtes WASM chargé depuis
     node_modules au runtime — le Dockerfile le copie) ;
   - ESM (.mjs) : le client Prisma généré utilise import.meta.url ;
   - banner : shim `require` pour les require() dynamiques (pg) en contexte ESM ;
   - `pg-native` (optionnel, absent) externe pour ne pas casser le bundle. */

import { build } from "esbuild";

// Sortie COMMITTÉE dans scripts/ (exécutable en prod sans build, sans tsx).
const entries = [
  ["scripts/storage-inspect.ts", "scripts/gedify-storage-inspect.mjs"],
  ["scripts/storage-doctor.ts", "scripts/gedify-storage-doctor.mjs"],
  ["scripts/previews-doctor.ts", "scripts/gedify-previews-doctor.mjs"],
  ["scripts/pipeline-doctor.ts", "scripts/gedify-pipeline-doctor.mjs"],
  ["scripts/ocr-doctor.ts", "scripts/gedify-ocr-doctor.mjs"],
  ["scripts/duplicates-doctor.ts", "scripts/gedify-duplicates-doctor.mjs"],
  ["scripts/backup-json.ts", "scripts/gedify-backup-json.mjs"],
  ["scripts/migrate-json.ts", "scripts/gedify-migrate-json.mjs"],
  ["scripts/db-push.ts", "scripts/gedify-db-push.mjs"],
  ["scripts/db-check.ts", "scripts/gedify-db-check.mjs"],
];

for (const [entry, outfile] of entries) {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    external: ["@prisma/client", "@prisma/client/*", "pg-native"],
    banner: {
      js: "import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);",
    },
    logLevel: "warning",
    legalComments: "none",
  });
  console.log(`✓ ${entry} → ${outfile}`);
}
