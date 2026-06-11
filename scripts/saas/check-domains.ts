/* saas:check-domains — état des domaines clients (lecture seule). */

import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = (await client.query("SELECT * FROM tenant_domains")).rows;
    } catch {
      console.log("⚠️  Table tenant_domains absente — exécutez `npm run db:push`.");
      process.exit(0);
    }
    const by = (pred: (r: Record<string, unknown>) => boolean) => rows.filter(pred).length;

    console.log("Domaines clients :");
    console.log(`   • Total              : ${rows.length}`);
    console.log(`   • Actifs             : ${by((r) => r.status === "active")}`);
    console.log(`   • En attente         : ${by((r) => r.status === "pending")}`);
    console.log(`   • Échec              : ${by((r) => r.status === "failed")}`);
    console.log(`   • Désactivés         : ${by((r) => r.status === "disabled")}`);
    console.log(`   • Non vérifiés       : ${by((r) => r.verification_status !== "verified")}`);
    console.log(`   • DNS valides        : ${by((r) => r.dns_status === "valid")}`);

    // Sans tenant
    const tenantIds = new Set((await client.query("SELECT id FROM tenants").catch(() => ({ rows: [] }))).rows.map((r) => String(r.id)));
    const orphan = rows.filter((r) => !tenantIds.has(String(r.tenant_id)));
    if (orphan.length) console.log(`   ⚠️  Domaines sans tenant valide : ${orphan.length}`);

    // Doublons (devrait être impossible avec l'unicité, mais on vérifie)
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(String(r.domain), (seen.get(String(r.domain)) ?? 0) + 1);
    const dups = [...seen.entries()].filter(([, n]) => n > 1);
    if (dups.length) console.log(`   ⚠️  Domaines en doublon : ${dups.map(([d]) => d).join(", ")}`);

    // Plusieurs domaines principaux pour un même tenant
    const primaryByTenant = new Map<string, number>();
    for (const r of rows) if (r.is_primary === true) primaryByTenant.set(String(r.tenant_id), (primaryByTenant.get(String(r.tenant_id)) ?? 0) + 1);
    const multiPrimary = [...primaryByTenant.entries()].filter(([, n]) => n > 1);
    if (multiPrimary.length) console.log(`   ⚠️  Tenants avec plusieurs domaines principaux : ${multiPrimary.map(([t]) => t).join(", ")}`);

    console.log("\n✅ check-domains terminé.");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-domains :", e instanceof Error ? e.message : String(e)); process.exit(1); });
