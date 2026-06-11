/* saas:check-entitlements — droits effectifs par tenant (lecture seule).

   Autonome via `pg` (DATABASE_URL). Reproduit la priorité d'entitlements :
   gratuité active > abonnement actif > tenant.plan > free. exit 0 si OK,
   exit 1 si incohérence (plan effectif introuvable / grant sans plan…). */

import { Client } from "pg";

function activeGrant(rows: { plan_code: string; starts_at: Date | null; ends_at: Date | null }[]): string | null {
  const now = Date.now();
  for (const g of rows) {
    if (g.starts_at && new Date(g.starts_at).getTime() > now) continue;
    if (g.ends_at && new Date(g.ends_at).getTime() <= now) continue;
    return g.plan_code;
  }
  return null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  const issues: string[] = [];
  const known = new Set(["free", "test", "pro", "business", "internal"]);
  try {
    // Plans connus = défauts + plans en table.
    try {
      const p = await client.query("SELECT code FROM saas_plans");
      for (const r of p.rows) known.add(String(r.code));
    } catch { /* table absente */ }

    const tenants = await client.query("SELECT id, name, plan, status FROM tenants ORDER BY id");
    for (const t of tenants.rows) {
      const tid = String(t.id);
      let grantPlan: string | null = null;
      try {
        const g = await client.query(
          "SELECT plan_code, starts_at, ends_at FROM subscription_grants WHERE tenant_id=$1 AND is_active=true ORDER BY created_at DESC",
          [tid],
        );
        grantPlan = activeGrant(g.rows);
      } catch { /* table absente */ }
      let subPlan: string | null = null, subStatus: string | null = null;
      try {
        const s = await client.query("SELECT plan, status FROM subscriptions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1", [tid]);
        if (s.rows[0]) { subStatus = s.rows[0].status ?? null; if (subStatus === "active" || subStatus === "trialing") subPlan = s.rows[0].plan ?? null; }
      } catch { /* table absente */ }

      const effective = grantPlan ?? subPlan ?? (t.plan ?? "free");
      const source = grantPlan ? "grant" : subPlan ? "subscription" : t.plan ? "tenant" : "free";

      if (!known.has(String(effective).toLowerCase())) issues.push(`${tid}: plan effectif inconnu « ${effective} »`);
      if ((t.status ?? "").toLowerCase() === "suspended") console.log(`• ${tid} ⛔ SUSPENDU`);

      console.log(`• ${tid} (${t.name ?? ""}) tenant.plan=${t.plan ?? "—"} sub=${subPlan ?? "—"}(${subStatus ?? "-"}) grant=${grantPlan ?? "—"} → effectif=${effective} [${source}]`);
    }

    console.log("");
    if (issues.length === 0) { console.log("✅ Droits effectifs cohérents."); process.exit(0); }
    console.error("❌ Incohérences :");
    for (const i of issues) console.error(`   - ${i}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("❌ saas:check-entitlements :", e instanceof Error ? e.message : String(e)); process.exit(1); });
