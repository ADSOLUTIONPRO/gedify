/* saas:check-memberships — cohérence des adhésions (lecture seule). Exit 1 si KO. */

import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  let problems = 0;
  try {
    const n = async (sql: string) => { try { return Number((await client.query(sql)).rows[0]?.n ?? 0); } catch { return -1; } };

    const noOwner = await n("SELECT COUNT(*)::int n FROM tenants t WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.tenant_id=t.id AND m.role='owner')");
    const multiOwner = await n("SELECT COUNT(*)::int n FROM (SELECT tenant_id FROM memberships WHERE role='owner' GROUP BY tenant_id HAVING COUNT(*)>1) d");
    const danglingUser = await n("SELECT COUNT(*)::int n FROM memberships m LEFT JOIN users u ON u.id=m.user_id WHERE u.id IS NULL");
    const danglingTenant = await n("SELECT COUNT(*)::int n FROM memberships m LEFT JOIN tenants t ON t.id=m.tenant_id WHERE t.id IS NULL");
    const inactiveOwner = await n("SELECT COUNT(*)::int n FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.role='owner' AND u.is_active=false");
    const badRole = await n("SELECT COUNT(*)::int n FROM memberships WHERE role NOT IN ('owner','admin','member','viewer')");
    const usersNoTenant = await n("SELECT COUNT(*)::int n FROM users u WHERE u.is_superuser<>true AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id=u.id)");

    console.log("Adhésions :");
    console.log(`   • Tenants sans owner        : ${noOwner}`);
    console.log(`   • Tenants à plusieurs owners: ${multiOwner}`);
    console.log(`   • Memberships sans user     : ${danglingUser}`);
    console.log(`   • Memberships sans tenant   : ${danglingTenant}`);
    console.log(`   • Owners inactifs           : ${inactiveOwner}`);
    console.log(`   • Rôles invalides           : ${badRole}`);
    console.log(`   • Utilisateurs sans tenant  : ${usersNoTenant} (non superuser)`);

    if (noOwner > 0 || danglingUser > 0 || danglingTenant > 0 || badRole > 0) problems++;

    // Invitations expirées encore en pending
    const staleInv = await n("SELECT COUNT(*)::int n FROM tenant_invitations WHERE status='pending' AND expires_at < now()");
    if (staleInv >= 0) console.log(`   • Invitations expirées non traitées : ${staleInv}`);
    if (staleInv > 0) console.log("     → lancez `npm run saas:expire-invitations`");

    if (problems === 0) console.log("\n✅ Adhésions cohérentes.");
    else console.log(`\n❌ ${problems} problème(s) détecté(s).`);
    process.exit(problems > 0 ? 1 : 0);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("❌ saas:check-memberships :", e instanceof Error ? e.message : String(e)); process.exit(1); });
