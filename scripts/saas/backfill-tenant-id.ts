/* saas:backfill-tenant — rattache les données métier existantes au tenant.

   Idempotent et autonome via `pg` (DATABASE_URL), exécutable dans le conteneur
   runtime (`node scripts/saas/backfill-tenant-id.mjs`).

   Pour chaque table métier scopée (documents, tags, correspondents,
   document_types, folders) :
     • ajoute la colonne tenant_id si absente (ADD COLUMN IF NOT EXISTS) ;
     • crée l'index si absent ;
     • affecte tenant_id = <tenant> aux lignes où il est NULL (relançable).

   Cible par défaut : azserver-staging (surchargeable via TENANT_ID). */

import { Client } from "pg";

const TENANT_ID = process.env.TENANT_ID?.trim() || "azserver-staging";
const TABLES = ["documents", "tags", "correspondents", "document_types", "folders"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL absente — multi-tenant requiert PostgreSQL.");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Vérifie que le tenant cible existe (avertissement seulement).
    try {
      const t = await client.query("SELECT id FROM tenants WHERE id = $1 LIMIT 1", [TENANT_ID]);
      if (t.rowCount === 0) {
        console.warn(`⚠️  Tenant « ${TENANT_ID} » introuvable — lancez d'abord: npm run saas:init-tenant`);
      }
    } catch {
      console.warn("⚠️  Table tenants absente — lancez d'abord: npm run db:push && npm run saas:init-tenant");
    }

    let total = 0;
    for (const table of TABLES) {
      try {
        await client.query(`ALTER TABLE IF EXISTS "${table}" ADD COLUMN IF NOT EXISTS tenant_id TEXT`);
        await client.query(`CREATE INDEX IF NOT EXISTS "${table}_tenant_id_idx" ON "${table}" (tenant_id)`);
        const res = await client.query(
          `UPDATE "${table}" SET tenant_id = $1 WHERE tenant_id IS NULL`,
          [TENANT_ID],
        );
        total += res.rowCount ?? 0;
        console.log(`   • ${table}: ${res.rowCount ?? 0} ligne(s) rattachée(s) → ${TENANT_ID}`);
      } catch (e) {
        console.warn(`   • ${table}: ignorée (${e instanceof Error ? e.message : String(e)})`);
      }
    }

    console.log(`✅ saas:backfill-tenant terminé (idempotent) — ${total} ligne(s) mises à jour au total.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ saas:backfill-tenant :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
