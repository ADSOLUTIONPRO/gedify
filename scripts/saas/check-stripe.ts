/* saas:check-stripe — état de la configuration/intégration Stripe (lecture seule).
   N'appelle JAMAIS Stripe. Lit l'env (présences sans secret) + la base. */

import { Client } from "pg";

function has(k: string): boolean {
  return Boolean(process.env[k]?.trim());
}

async function main() {
  console.log("Stripe :");
  console.log(`   • STRIPE_ENABLED      : ${process.env.STRIPE_ENABLED ?? "(absent)"}`);
  console.log(`   • STRIPE_MODE         : ${process.env.STRIPE_MODE ?? "(absent)"}`);
  console.log(`   • STRIPE_SECRET_KEY   : ${has("STRIPE_SECRET_KEY") ? "présente" : "absente"}`);
  console.log(`   • STRIPE_WEBHOOK_SECRET: ${has("STRIPE_WEBHOOK_SECRET") ? "présent" : "absent"}`);
  console.log(`   • SUCCESS/CANCEL URL  : ${has("STRIPE_SUCCESS_URL") ? "ok" : "défaut"}/${has("STRIPE_CANCEL_URL") ? "ok" : "défaut"}`);

  const url = process.env.DATABASE_URL;
  if (!url) { console.log("\n(DATABASE_URL absente — pas de stats base.)"); process.exit(0); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const n = async (sql: string) => {
      try { return Number((await client.query(sql)).rows[0]?.n ?? 0); } catch { return -1; }
    };
    const plans = await n("SELECT COUNT(*)::int n FROM saas_plans WHERE stripe_product_id IS NOT NULL");
    const customers = await n("SELECT COUNT(DISTINCT provider_customer_id)::int n FROM subscriptions WHERE provider='stripe' AND provider_customer_id IS NOT NULL");
    const subs = await n("SELECT COUNT(*)::int n FROM subscriptions WHERE provider='stripe' AND provider_subscription_id IS NOT NULL");
    const events = await n("SELECT COUNT(*)::int n FROM payment_events WHERE provider='stripe'");
    console.log("\nBase :");
    console.log(`   • Plans avec product/price Stripe : ${plans}`);
    console.log(`   • Tenants avec customer Stripe     : ${customers}`);
    console.log(`   • Abonnements Stripe               : ${subs}`);
    console.log(`   • Événements webhook traités       : ${events}`);
    console.log("\n✅ check-stripe terminé (aucun appel Stripe effectué).");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-stripe :", e instanceof Error ? e.message : String(e)); process.exit(1); });
