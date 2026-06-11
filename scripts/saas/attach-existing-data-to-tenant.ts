/* saas:attach-data — rattache TOUTES les données métier existantes au tenant.

   Migration douce, idempotente, autonome via `pg` (DATABASE_URL), exécutable
   dans le conteneur runtime (`node scripts/saas/attach-existing-data-to-tenant.mjs`).

   Pour chaque table métier portant tenant_id :
     • ajoute la colonne tenant_id si absente (ADD COLUMN IF NOT EXISTS) ;
     • crée l'index si absent ;
     • affecte tenant_id = <tenant> aux lignes encore NULL (ne touche pas les
       lignes déjà rattachées) ;
     • relançable sans doublon ni erreur.

   Cible par défaut : azserver-staging (surchargeable via TENANT_ID).

   NB : document_tags et folder_documents ne sont PAS traités : ces relations
   sont embarquées dans le blob du parent (tags = document.tags ;
   liens dossier = folder.linkedDocumentIds) → déjà isolées via le tenant_id du
   parent (documents/folders). */

import { Client } from "pg";

const TENANT_ID = process.env.TENANT_ID?.trim() || "azserver-staging";

const TABLES: { table: string; label: string }[] = [
  { table: "documents", label: "documents" },
  { table: "tags", label: "tags" },
  { table: "correspondents", label: "correspondents" },
  { table: "document_types", label: "document_types" },
  { table: "folders", label: "folders" },
  { table: "document_files", label: "document_files (relations)" },
  { table: "document_correspondents", label: "document_correspondents (relations)" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL absente — multi-tenant requiert PostgreSQL.");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Le tenant cible doit exister (avertissement seulement).
    try {
      const t = await client.query("SELECT id FROM tenants WHERE id = $1 LIMIT 1", [TENANT_ID]);
      if (t.rowCount === 0) {
        console.warn(`⚠️  Tenant « ${TENANT_ID} » introuvable — lancez d'abord: npm run saas:init-tenant`);
      }
    } catch {
      console.warn("⚠️  Table tenants absente — lancez: npm run db:push && npm run saas:init-tenant");
    }

    console.log(`Rattachement des données existantes au tenant « ${TENANT_ID} » :`);
    const summary: { label: string; attached: number }[] = [];
    for (const { table, label } of TABLES) {
      try {
        await client.query(`ALTER TABLE IF EXISTS "${table}" ADD COLUMN IF NOT EXISTS tenant_id TEXT`);
        await client.query(`CREATE INDEX IF NOT EXISTS "${table}_tenant_id_idx" ON "${table}" (tenant_id)`);
        const res = await client.query(
          `UPDATE "${table}" SET tenant_id = $1 WHERE tenant_id IS NULL`,
          [TENANT_ID],
        );
        const attached = res.rowCount ?? 0;
        summary.push({ label, attached });
        console.log(`   • ${label.padEnd(34)}: ${attached} rattaché(s)`);
      } catch (e) {
        console.warn(`   • ${label.padEnd(34)}: ignorée (${e instanceof Error ? e.message : String(e)})`);
      }
    }

    const total = summary.reduce((s, x) => s + x.attached, 0);
    console.log(`✅ saas:attach-data terminé (idempotent) — ${total} ligne(s) rattachée(s) au total.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ saas:attach-data :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
