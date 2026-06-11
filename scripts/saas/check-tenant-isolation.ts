/* saas:check-isolation — vérifie l'isolation multi-tenant (lecture seule).

   Autonome via `pg` (DATABASE_URL), exécutable dans le conteneur runtime
   (`node scripts/saas/check-tenant-isolation.mjs`).

   Contrôles :
     • tenants actifs ;
     • lignes métier SANS tenant_id (documents, tags, correspondents,
       document_types, folders, document_files, document_correspondents) ;
     • cohérence des relations document_correspondents :
         - tenant_id de la relation == tenant_id du document,
         - tenant_id du correspondant == tenant_id de la relation.

   Sortie : exit 0 si tout est OK, exit 1 si une fuite/incohérence est détectée. */

import { Client } from "pg";

const NULL_TABLES = [
  "documents",
  "tags",
  "correspondents",
  "document_types",
  "folders",
  "document_files",
  "document_correspondents",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL absente — multi-tenant requiert PostgreSQL.");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  const failures: string[] = [];

  async function scalar(sql: string): Promise<number | null> {
    try {
      const { rows } = await client.query(sql);
      return Number(rows[0]?.n ?? 0);
    } catch {
      return null; // table/colonne absente → ignorée
    }
  }

  try {
    // 1. Tenants actifs
    try {
      const { rows } = await client.query("SELECT id, name, status FROM tenants ORDER BY id");
      console.log(`Tenants (${rows.length}) :`);
      for (const r of rows) console.log(`   • ${r.id} — ${r.name ?? ""} [${r.status ?? "?"}]`);
    } catch {
      failures.push("table tenants introuvable (lancez db:push + saas:init-tenant)");
    }

    // 2. Lignes sans tenant_id
    console.log("\nLignes sans tenant_id :");
    for (const table of NULL_TABLES) {
      const n = await scalar(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE tenant_id IS NULL`);
      if (n == null) {
        console.log(`   • ${table.padEnd(26)}: (table/colonne absente)`);
        continue;
      }
      console.log(`   • ${table.padEnd(26)}: ${n}`);
      if (n > 0) failures.push(`${n} ligne(s) sans tenant_id dans ${table}`);
    }

    // 3. Cohérence des relations document_correspondents
    console.log("\nCohérence des relations :");
    const relVsDoc = await scalar(
      `SELECT COUNT(*)::int AS n FROM document_correspondents dc
         JOIN documents d ON d.id = dc.document_id
        WHERE dc.tenant_id IS DISTINCT FROM d.tenant_id`,
    );
    if (relVsDoc == null) {
      console.log("   • relation↔document        : (non vérifiable)");
    } else {
      console.log(`   • relation↔document        : ${relVsDoc} incohérence(s)`);
      if (relVsDoc > 0) failures.push(`${relVsDoc} relation(s) document_correspondents avec tenant ≠ document`);
    }
    const corrVsRel = await scalar(
      `SELECT COUNT(*)::int AS n FROM document_correspondents dc
         JOIN correspondents c ON c.id = dc.correspondent_id
        WHERE c.tenant_id IS DISTINCT FROM dc.tenant_id`,
    );
    if (corrVsRel == null) {
      console.log("   • correspondant↔relation   : (non vérifiable)");
    } else {
      console.log(`   • correspondant↔relation   : ${corrVsRel} incohérence(s)`);
      if (corrVsRel > 0) failures.push(`${corrVsRel} correspondant(s) liés dans un autre tenant`);
    }

    // 4. Répartition par tenant (info)
    console.log("\nRépartition par tenant :");
    for (const table of ["documents", "tags", "correspondents", "document_types", "folders"]) {
      try {
        const { rows } = await client.query(
          `SELECT COALESCE(tenant_id, '∅') AS t, COUNT(*)::int AS n FROM "${table}" GROUP BY tenant_id ORDER BY t`,
        );
        const parts = rows.map((r) => `${r.t}=${r.n}`).join(", ");
        console.log(`   • ${table.padEnd(16)}: ${parts || "(vide)"}`);
      } catch {
        console.log(`   • ${table.padEnd(16)}: (absente)`);
      }
    }

    console.log("");
    if (failures.length === 0) {
      console.log("✅ Isolation tenant OK — aucune fuite ni incohérence détectée.");
      process.exit(0);
    } else {
      console.error("❌ Isolation tenant : anomalies détectées :");
      for (const f of failures) console.error(`   - ${f}`);
      console.error("→ Lancez `npm run saas:attach-data` puis relancez ce contrôle.");
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ saas:check-isolation :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
