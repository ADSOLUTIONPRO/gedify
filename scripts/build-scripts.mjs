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
  ["scripts/classification-doctor.ts", "scripts/gedify-classification-doctor.mjs"],
  ["scripts/duplicates-doctor.ts", "scripts/gedify-duplicates-doctor.mjs"],
  ["scripts/integrity-doctor.ts", "scripts/gedify-integrity-doctor.mjs"],
  ["scripts/backup-doctor.ts", "scripts/gedify-backup-doctor.mjs"],
  ["scripts/diagnostic-doctor.ts", "scripts/gedify-diagnostic-doctor.mjs"],
  ["scripts/security-doctor.ts", "scripts/gedify-security-doctor.mjs"],
  ["scripts/finances-doctor.ts", "scripts/gedify-finances-doctor.mjs"],
  ["scripts/mails-doctor.ts", "scripts/gedify-mails-doctor.mjs"],
  ["scripts/backup-json.ts", "scripts/gedify-backup-json.mjs"],
  ["scripts/migrate-json.ts", "scripts/gedify-migrate-json.mjs"],
  ["scripts/db-push.ts", "scripts/gedify-db-push.mjs"],
  ["scripts/db-check.ts", "scripts/gedify-db-check.mjs"],
  ["scripts/saas/create-initial-tenant.ts", "scripts/saas/create-initial-tenant.mjs"],
  ["scripts/saas/backfill-tenant-id.ts", "scripts/saas/backfill-tenant-id.mjs"],
  ["scripts/saas/attach-existing-data-to-tenant.ts", "scripts/saas/attach-existing-data-to-tenant.mjs"],
  ["scripts/saas/check-tenant-isolation.ts", "scripts/saas/check-tenant-isolation.mjs"],
  ["scripts/saas/create-test-tenant.ts", "scripts/saas/create-test-tenant.mjs"],
  ["scripts/saas/test-two-tenant-isolation.ts", "scripts/saas/test-two-tenant-isolation.mjs"],
  ["scripts/saas/create-tenant.ts", "scripts/saas/create-tenant.mjs"],
  ["scripts/saas/check-quotas.ts", "scripts/saas/check-quotas.mjs"],
  ["scripts/saas/check-subscriptions.ts", "scripts/saas/check-subscriptions.mjs"],
  ["scripts/saas/create-manual-subscription.ts", "scripts/saas/create-manual-subscription.mjs"],
  ["scripts/saas/check-entitlements.ts", "scripts/saas/check-entitlements.mjs"],
  ["scripts/saas/check-stripe.ts", "scripts/saas/check-stripe.mjs"],
  ["scripts/saas/check-billing.ts", "scripts/saas/check-billing.mjs"],
  ["scripts/saas/check-mailing.ts", "scripts/saas/check-mailing.mjs"],
  ["scripts/saas/seed-mail-templates.ts", "scripts/saas/seed-mail-templates.mjs"],
  ["scripts/saas/process-mail-queue.ts", "scripts/saas/process-mail-queue.mjs"],
  ["scripts/saas/check-support.ts", "scripts/saas/check-support.mjs"],
  ["scripts/saas/check-encryption.ts", "scripts/saas/check-encryption.mjs"],
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
