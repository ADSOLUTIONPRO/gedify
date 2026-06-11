/* saas:check-security — synthèse du journal de sécurité (lecture seule). */

import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const n = async (sql: string) => {
      try { return Number((await client.query(sql)).rows[0]?.n ?? 0); } catch { return -1; }
    };
    let total = -1;
    try { total = Number((await client.query("SELECT COUNT(*)::int n FROM security_events")).rows[0]?.n ?? 0); }
    catch { console.log("⚠️  Table security_events absente — exécutez `npm run db:push`."); process.exit(0); }

    const critOpen = await n("SELECT COUNT(*)::int n FROM security_events WHERE severity='critical' AND status='open'");
    const warnOpen = await n("SELECT COUNT(*)::int n FROM security_events WHERE severity='warning' AND status='open'");
    const failed24 = await n("SELECT COUNT(*)::int n FROM security_events WHERE event_type='login_failed' AND created_at > now()-interval '24 hours'");
    const cross = await n("SELECT COUNT(*)::int n FROM security_events WHERE event_type='cross_tenant_access_attempt'");
    const unauth = await n("SELECT COUNT(*)::int n FROM security_events WHERE event_type='unauthorized_access' AND created_at > now()-interval '7 days'");
    const encErr = await n("SELECT COUNT(*)::int n FROM security_events WHERE category='encryption' AND severity='critical'");
    const suspended = await n("SELECT COUNT(*)::int n FROM tenants WHERE status='suspended'");
    const adminActions = await n("SELECT COUNT(*)::int n FROM security_events WHERE category='system' AND created_at > now()-interval '7 days'");

    console.log("Sécurité :");
    console.log(`   • Événements (total)         : ${total}`);
    console.log(`   • Critiques ouverts          : ${critOpen}`);
    console.log(`   • Avertissements ouverts     : ${warnOpen}`);
    console.log(`   • Échecs login 24h           : ${failed24}`);
    console.log(`   • Tentatives cross-tenant    : ${cross}`);
    console.log(`   • Accès non autorisés (7j)   : ${unauth}`);
    console.log(`   • Erreurs chiffrement        : ${encErr}`);
    console.log(`   • Tenants suspendus          : ${suspended}`);
    console.log(`   • Actions superadmin (7j)    : ${adminActions}`);

    // IP suspectes (≥5 échecs/h)
    try {
      const { rows } = await client.query(
        `SELECT ip_address ip, COUNT(*)::int n FROM security_events
          WHERE event_type='login_failed' AND ip_address IS NOT NULL AND created_at > now()-interval '1 hour'
          GROUP BY ip_address HAVING COUNT(*) >= 5 ORDER BY n DESC LIMIT 10`,
      );
      if (rows.length) { console.log("\n   ⚠️  IP suspectes (≥5 échecs/h) :"); for (const r of rows) console.log(`      - ${r.ip} : ${r.n} échecs`); }
    } catch { /* ignore */ }

    if (critOpen > 0) console.log(`\n   ❗ ${critOpen} alerte(s) critique(s) à traiter sur /admin/saas/security`);
    console.log("\n✅ check-security terminé.");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-security :", e instanceof Error ? e.message : String(e)); process.exit(1); });
