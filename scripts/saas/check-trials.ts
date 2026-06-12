/* saas:check-trials — état des périodes d'essai (lecture seule). */

import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const n = async (sql: string) => { try { return Number((await client.query(sql)).rows[0]?.n ?? 0); } catch { return -1; } };

    const trialing = await n("SELECT COUNT(*)::int n FROM subscriptions WHERE status='trialing'");
    if (trialing < 0) { console.log("⚠️  Table subscriptions absente — exécutez `npm run db:push`."); process.exit(0); }

    console.log("Périodes d'essai :");
    console.log(`   • Actives                    : ${trialing}`);
    console.log(`   • Expirent ≤ 7 jours         : ${await n("SELECT COUNT(*)::int n FROM subscriptions WHERE status='trialing' AND trial_end IS NOT NULL AND trial_end <= now()+interval '7 days' AND trial_end > now()")}`);
    console.log(`   • Expirent ≤ 3 jours         : ${await n("SELECT COUNT(*)::int n FROM subscriptions WHERE status='trialing' AND trial_end IS NOT NULL AND trial_end <= now()+interval '3 days' AND trial_end > now()")}`);
    const overdue = await n("SELECT COUNT(*)::int n FROM subscriptions WHERE status='trialing' AND trial_end IS NOT NULL AND trial_end < now()");
    console.log(`   • Expirées non traitées      : ${overdue}`);
    if (overdue > 0) console.log("     → lancez le cron /api/cron/mailing (ou la page Essais → Lancer relances/expirations)");
    console.log(`   • Convertis (active + trial) : ${await n("SELECT COUNT(*)::int n FROM subscriptions WHERE status='active' AND trial_end IS NOT NULL")}`);

    const noEnd = await n("SELECT COUNT(*)::int n FROM subscriptions WHERE status='trialing' AND trial_end IS NULL");
    if (noEnd > 0) console.log(`   ⚠️  Trialing sans trial_end : ${noEnd}`);

    console.log("\n✅ check-trials terminé.");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-trials :", e instanceof Error ? e.message : String(e)); process.exit(1); });
