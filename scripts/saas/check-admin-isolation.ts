/* saas:check-admin-isolation — détecte des fuites potentielles d'isolation dans
   la zone Administration (lecture seule). Exit 1 si problème d'isolation. */

import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  let problems = 0;
  try {
    const n = async (sql: string) => {
      try { return Number((await client.query(sql)).rows[0]?.n ?? 0); } catch { return -1; }
    };

    console.log("Isolation Administration :");

    // 1. Memberships pendantes (user/tenant inexistant)
    const danglingUser = await n("SELECT COUNT(*)::int n FROM memberships m LEFT JOIN users u ON u.id = m.user_id WHERE u.id IS NULL");
    const danglingTenant = await n("SELECT COUNT(*)::int n FROM memberships m LEFT JOIN tenants t ON t.id = m.tenant_id WHERE t.id IS NULL");
    console.log(`   • Memberships sans utilisateur : ${danglingUser}`);
    console.log(`   • Memberships sans tenant      : ${danglingTenant}`);
    if (danglingUser > 0 || danglingTenant > 0) problems++;

    // 2. Tenants sans owner
    const noOwner = await n("SELECT COUNT(*)::int n FROM tenants t WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.tenant_id = t.id AND m.role='owner')");
    console.log(`   • Tenants sans owner           : ${noOwner}`);
    if (noOwner > 0) problems++;

    // 3. Données métier sans tenant_id (fuite potentielle côté client)
    for (const table of ["documents", "tags", "correspondents", "document_types"]) {
      const orphan = await n(`SELECT COUNT(*)::int n FROM ${table} WHERE tenant_id IS NULL`);
      if (orphan > 0) { console.log(`   ⚠️  ${table} sans tenant_id : ${orphan} (lancez saas:attach-data)`); problems++; }
    }

    // 4. Événements de sécurité « tenant » sans tenant_id
    const evtNoTenant = await n("SELECT COUNT(*)::int n FROM security_events WHERE category='tenant' AND tenant_id IS NULL");
    if (evtNoTenant > 0) console.log(`   ⚠️  security_events tenant sans tenant_id : ${evtNoTenant}`);

    // 5. Utilisateurs sans aucun membership (hors superusers) — invisibles aux tenants, info
    const noMembership = await n("SELECT COUNT(*)::int n FROM users u WHERE u.is_superuser <> true AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)");
    console.log(`   • Utilisateurs sans tenant (non superuser) : ${noMembership}`);

    if (problems === 0) console.log("\n✅ Aucune fuite d'isolation détectée.");
    else console.log(`\n❌ ${problems} problème(s) d'isolation détecté(s).`);
    process.exit(problems > 0 ? 1 : 0);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("❌ saas:check-admin-isolation :", e instanceof Error ? e.message : String(e)); process.exit(1); });
