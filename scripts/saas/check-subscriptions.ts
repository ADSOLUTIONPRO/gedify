/* saas:check-subscriptions — état des abonnements par tenant (lecture seule).
   Autonome via `pg` (DATABASE_URL). exit 0 si OK, exit 1 si incohérence. */

import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  const issues: string[] = [];
  try {
    const tenants = await client.query("SELECT id, name, status FROM tenants ORDER BY id");
    let active = 0, trialing = 0, pastDue = 0, canceled = 0, none = 0;

    for (const t of tenants.rows) {
      const tenantId = String(t.id);
      const tStatus = (t.status ?? "").toLowerCase();
      const sres = await client
        .query("SELECT status FROM subscriptions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1", [tenantId])
        .catch(() => ({ rows: [] as { status?: string }[] }));
      const sub = sres.rows[0]?.status ? String(sres.rows[0].status) : null;

      if (!sub) none++;
      else if (sub === "active") active++;
      else if (sub === "trialing") trialing++;
      else if (sub === "past_due") pastDue++;
      else if (sub === "canceled") canceled++;

      // Incohérences
      if (tStatus === "suspended" && sub === "active")
        issues.push(`${tenantId}: tenant suspended mais abonnement active`);
      if (tStatus === "active" && (sub === "canceled" || sub === "unpaid"))
        issues.push(`${tenantId}: tenant active mais abonnement ${sub}`);

      console.log(`• ${tenantId} (${t.name ?? ""}) tenant.status=${tStatus || "?"} subscription=${sub ?? "(aucun)"}`);
    }

    console.log("");
    console.log(`Résumé : actifs=${active} trialing=${trialing} past_due=${pastDue} canceled=${canceled} sans_abo=${none}`);
    if (issues.length === 0) {
      console.log("✅ Abonnements cohérents.");
      process.exit(0);
    } else {
      console.error("❌ Incohérences :");
      for (const i of issues) console.error(`   - ${i}`);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("❌ saas:check-subscriptions :", e instanceof Error ? e.message : String(e)); process.exit(1); });
