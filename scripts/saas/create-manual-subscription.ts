/* saas:create-manual-subscription — crée/maj un abonnement manuel (CLI).
   Usage : npm run saas:create-manual-subscription -- --tenant=azserver-staging --plan=internal --status=active
   Autonome via `pg` (DATABASE_URL). Idempotent (maj de l'abonnement existant). */

import { Client } from "pg";
import { randomUUID } from "node:crypto";

const STATUSES = ["trialing", "active", "past_due", "canceled", "unpaid", "paused", "incomplete"];

const DDL = `
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, plan TEXT, status TEXT,
  provider TEXT NOT NULL DEFAULT 'manual', provider_customer_id TEXT, provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ, trial_start TIMESTAMPTZ, trial_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ, canceled_at TIMESTAMPTZ, manual_grant_id TEXT, promo_code_id TEXT,
  discount_until TIMESTAMPTZ, free_until TIMESTAMPTZ, is_free_forever BOOLEAN NOT NULL DEFAULT false,
  raw JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

function arg(argv: string[], key: string): string | undefined {
  for (const a of argv) if (a.startsWith(`--${key}=`)) return a.slice(key.length + 3);
  return undefined;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const argv = process.argv.slice(2);
  const tenant = (arg(argv, "tenant") ?? "").trim();
  const plan = (arg(argv, "plan") ?? "free").trim().toLowerCase();
  const status = (arg(argv, "status") ?? "active").trim().toLowerCase();
  if (!tenant) { console.error("❌ --tenant requis."); process.exit(1); }
  if (!STATUSES.includes(status)) { console.error(`❌ --status invalide (${STATUSES.join("|")}).`); process.exit(1); }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(DDL);
    const t = await client.query("SELECT id FROM tenants WHERE id=$1 LIMIT 1", [tenant]).catch(() => ({ rowCount: 0 }));
    if (!t.rowCount) console.warn(`⚠️  Tenant « ${tenant} » introuvable (l'abonnement sera quand même créé).`);

    const existing = await client.query("SELECT id FROM subscriptions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1", [tenant]);
    if (existing.rows[0]) {
      await client.query("UPDATE subscriptions SET plan=$1, status=$2, updated_at=now() WHERE id=$3", [plan, status, existing.rows[0].id]);
      console.log(`✅ Abonnement mis à jour : ${tenant} → plan=${plan} status=${status}`);
    } else {
      await client.query(
        "INSERT INTO subscriptions(id, tenant_id, plan, status, provider) VALUES($1,$2,$3,$4,'manual')",
        [randomUUID(), tenant, plan, status],
      );
      console.log(`✅ Abonnement créé : ${tenant} → plan=${plan} status=${status}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("❌ saas:create-manual-subscription :", e instanceof Error ? e.message : String(e)); process.exit(1); });
