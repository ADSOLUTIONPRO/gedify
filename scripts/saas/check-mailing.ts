/* saas:check-mailing — état du mailing (lecture seule).
   Vérifie l'activation, la présence de la config SMTP (SANS jamais lire/afficher
   SMTP_PASSWORD), et les statistiques file/modèles/campagnes. N'envoie rien. */

import { Client } from "pg";

function has(k: string): boolean {
  return Boolean(process.env[k]?.trim());
}
function flag(name: string): string {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on" ? "activé" : "désactivé";
}

async function main() {
  console.log("Mailing :");
  console.log(`   • EMAILS_ENABLED : ${flag("EMAILS_ENABLED")}`);
  console.log(`   • SMTP_HOST      : ${has("SMTP_HOST") ? "présent" : "absent"}`);
  console.log(`   • SMTP_USER      : ${has("SMTP_USER") || has("SMTP_USERNAME") ? "présent" : "absent"}`);
  console.log(`   • SMTP_PASSWORD  : ${has("SMTP_PASSWORD") || has("SMTP_PASS") ? "présent (masqué)" : "absent"}`);
  console.log(`   • MAIL_FROM      : ${has("MAIL_FROM") || has("SMTP_FROM") ? "présent" : "absent"}`);
  console.log(`   • SMTP_PORT      : ${process.env.SMTP_PORT?.trim() || "(défaut 465)"}`);

  const url = process.env.DATABASE_URL;
  if (!url) { console.log("\n(DATABASE_URL absente — pas de stats base.)"); process.exit(0); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const n = async (sql: string) => {
      try { return Number((await client.query(sql)).rows[0]?.n ?? 0); } catch { return -1; }
    };
    const templates = await n("SELECT COUNT(*)::int n FROM mail_templates");
    const enabledTpl = await n("SELECT COUNT(*)::int n FROM mail_templates WHERE enabled = true");
    const queued = await n("SELECT COUNT(*)::int n FROM mail_queue WHERE status='pending'");
    const sent = await n("SELECT COUNT(*)::int n FROM mail_queue WHERE status='sent'");
    const failed = await n("SELECT COUNT(*)::int n FROM mail_queue WHERE status='failed'");
    const stuck = await n("SELECT COUNT(*)::int n FROM mail_queue WHERE status='sending' AND updated_at < now() - interval '15 minutes'");
    const campaigns = await n("SELECT COUNT(*)::int n FROM mail_campaigns");
    const prefs = await n("SELECT COUNT(*)::int n FROM mail_preferences");
    const unsub = await n("SELECT COUNT(*)::int n FROM mail_preferences WHERE unsub_all = true OR unsub_marketing = true");

    console.log("\nBase :");
    console.log(`   • Modèles (actifs)    : ${templates} (${enabledTpl})`);
    console.log(`   • File : en attente   : ${queued}`);
    console.log(`   • File : envoyés      : ${sent}`);
    console.log(`   • File : échoués      : ${failed}`);
    if (stuck > 0) console.log(`   ⚠️  Messages bloqués en 'sending' (>15min) : ${stuck}`);
    console.log(`   • Campagnes           : ${campaigns}`);
    console.log(`   • Préférences (désinscrits) : ${prefs} (${unsub})`);
    if (templates === 0) console.log("\n   ⚠️  Aucun modèle en base — lancez `npm run saas:seed-mail-templates`.");
    console.log("\n✅ check-mailing terminé (aucun email envoyé).");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-mailing :", e instanceof Error ? e.message : String(e)); process.exit(1); });
