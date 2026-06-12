/* saas:check-invitations — cohérence des invitations (lecture seule). */

import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    let total = -1;
    try { total = Number((await client.query("SELECT COUNT(*)::int n FROM tenant_invitations")).rows[0]?.n ?? 0); }
    catch { console.log("⚠️  Table tenant_invitations absente — exécutez `npm run db:push`."); process.exit(0); }
    const n = async (sql: string) => { try { return Number((await client.query(sql)).rows[0]?.n ?? 0); } catch { return -1; } };

    console.log("Invitations :");
    console.log(`   • Total                       : ${total}`);
    console.log(`   • En attente                  : ${await n("SELECT COUNT(*)::int n FROM tenant_invitations WHERE status='pending'")}`);
    console.log(`   • Acceptées                   : ${await n("SELECT COUNT(*)::int n FROM tenant_invitations WHERE status='accepted'")}`);
    console.log(`   • Expirées                    : ${await n("SELECT COUNT(*)::int n FROM tenant_invitations WHERE status='expired'")}`);
    console.log(`   • Annulées                    : ${await n("SELECT COUNT(*)::int n FROM tenant_invitations WHERE status='canceled'")}`);

    const staleP = await n("SELECT COUNT(*)::int n FROM tenant_invitations WHERE status='pending' AND expires_at < now()");
    if (staleP > 0) console.log(`   ⚠️  Pending expirées (à traiter) : ${staleP}`);
    const noTenant = await n("SELECT COUNT(*)::int n FROM tenant_invitations i LEFT JOIN tenants t ON t.id=i.tenant_id WHERE t.id IS NULL");
    if (noTenant > 0) console.log(`   ⚠️  Sans tenant valide : ${noTenant}`);
    const noInviter = await n("SELECT COUNT(*)::int n FROM tenant_invitations WHERE invited_by_user_id IS NULL");
    if (noInviter > 0) console.log(`   • Sans invited_by : ${noInviter}`);
    const noToken = await n("SELECT COUNT(*)::int n FROM tenant_invitations WHERE token_hash IS NULL OR token_hash=''");
    if (noToken > 0) console.log(`   ❌ Sans token_hash : ${noToken}`);
    const overSent = await n("SELECT COUNT(*)::int n FROM tenant_invitations WHERE send_count > 10");
    if (overSent > 0) console.log(`   ⚠️  Renvoyées >10 fois : ${overSent}`);

    // Vers des emails déjà membres
    const alreadyMember = await n(`
      SELECT COUNT(*)::int n FROM tenant_invitations i
      JOIN memberships m ON m.tenant_id=i.tenant_id
      JOIN users u ON u.id=m.user_id
      WHERE i.status='pending' AND lower(u.email)=lower(i.email)`);
    if (alreadyMember > 0) console.log(`   ⚠️  Pending vers des membres existants : ${alreadyMember}`);

    console.log("\n✅ check-invitations terminé.");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-invitations :", e instanceof Error ? e.message : String(e)); process.exit(1); });
