/* saas:check-settings — cohérence des réglages globaux (lecture seule).
   Ne lit/affiche AUCUN secret (seulement des présences). */

import { Client } from "pg";

function flag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}
function has(k: string): boolean { return Boolean(process.env[k]?.trim()); }

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  const warns: string[] = [];
  try {
    let data: Record<string, unknown> | null = null;
    try {
      const { rows } = await client.query("SELECT data FROM saas_settings WHERE id='global' LIMIT 1");
      data = (rows[0]?.data as Record<string, unknown>) ?? null;
    } catch {
      console.log("⚠️  Table saas_settings absente — exécutez `npm run db:push` (les valeurs par défaut s'appliquent).");
    }
    const sec = (k: string) => (data?.[k] as Record<string, unknown>) ?? {};
    const signup = sec("signup"), emails = sec("emails"), payment = sec("payment"), billing = sec("billing"), support = sec("support"), features = sec("features");

    console.log("Réglages SaaS :");
    console.log(`   • Enregistrés en base : ${data ? "oui" : "non (défauts)"}`);

    // Inscriptions
    const pubSignup = features.publicSignup === true && signup.publicSignupEnabled === true;
    console.log(`   • Inscription publique : ${pubSignup ? "OUVERTE" : "fermée"}${signup.inviteOnly ? " (sur invitation)" : ""}`);
    if (signup.publicSignupEnabled === true && features.publicSignup !== true) warns.push("Inscription publique activée mais interrupteur global publicSignup OFF.");

    // E-mails
    console.log(`   • EMAILS_ENABLED      : ${flag("EMAILS_ENABLED") ? "oui" : "non"}`);
    if (flag("EMAILS_ENABLED") && !(has("SMTP_HOST") && (has("SMTP_USER") || has("SMTP_USERNAME")) && (has("SMTP_PASSWORD") || has("SMTP_PASS")))) {
      warns.push("EMAILS_ENABLED=true mais configuration SMTP incomplète.");
    }
    if (!emails.supportEmail) warns.push("Email support non renseigné.");
    if (!emails.billingEmail) warns.push("Email facturation non renseigné.");

    // Stripe
    console.log(`   • STRIPE_ENABLED      : ${flag("STRIPE_ENABLED") ? "oui" : "non"} (mode ${process.env.STRIPE_MODE ?? "off"})`);
    if (flag("STRIPE_ENABLED") && !has("STRIPE_SECRET_KEY")) warns.push("STRIPE_ENABLED=true mais STRIPE_SECRET_KEY absente.");

    // Chiffrement
    console.log(`   • Chiffrement (KEK)   : ${has("ENCRYPTION_MASTER_KEY") ? "présente" : "absente"}`);

    // Politiques
    const grace = Number(payment.graceDays ?? 0);
    console.log(`   • Politique paiement  : grâce ${grace}j, relances ${payment.autoRemindersEnabled ? "auto" : "off"}`);
    if (grace <= 0) warns.push("Délai de grâce paiement = 0.");
    console.log(`   • Support humain      : ${support.humanSupportEnabled ? "oui" : "non"}`);
    console.log(`   • Facturation         : préfixes ${billing.invoicePrefix ?? "FAC"}/${billing.creditNotePrefix ?? "AVOIR"}, TVA ${billing.defaultVatRate ?? 20}%, ${billing.currency ?? "EUR"}`);
    if (!billing.invoicePrefix || !billing.creditNotePrefix) warns.push("Préfixes de facturation manquants.");

    // Interrupteurs globaux off
    const off = Object.entries(features).filter(([, v]) => v === false).map(([k]) => k);
    if (off.length) console.log(`   • Fonctionnalités coupées globalement : ${off.join(", ")}`);

    if (warns.length) { console.log("\nAvertissements :"); for (const w of warns) console.log(`   ⚠️  ${w}`); }
    else console.log("\n✅ Aucune incohérence détectée.");
    console.log("\n✅ check-settings terminé (aucun secret affiché).");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-settings :", e instanceof Error ? e.message : String(e)); process.exit(1); });
