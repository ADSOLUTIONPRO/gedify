/* saas:check-billing — état de la facturation (lecture seule).
   Vérifie : profil émetteur (présence + champs légaux), numérotation,
   et statistiques factures/avoirs. N'écrit rien. */

import { Client } from "pg";

const REQUIRED: Array<[string, string]> = [
  ["company_name", "Société"],
  ["address_line1", "Adresse"],
  ["postal_code", "Code postal"],
  ["city", "Ville"],
  ["email", "Email"],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const n = async (sql: string) => {
      try { return Number((await client.query(sql)).rows[0]?.n ?? 0); } catch { return -1; }
    };

    // Profil émetteur par défaut
    console.log("Profil émetteur :");
    let profile: Record<string, unknown> | null = null;
    try {
      const { rows } = await client.query("SELECT * FROM billing_profiles ORDER BY is_default DESC, created_at ASC LIMIT 1");
      profile = rows[0] ?? null;
    } catch { profile = null; }

    if (!profile) {
      console.log("   ⚠️  Aucun profil configuré (créez-le via /admin/saas/billing/profile).");
    } else {
      const missing = REQUIRED.filter(([k]) => !String(profile?.[k] ?? "").trim()).map(([, lbl]) => lbl);
      console.log(`   • Société           : ${profile.company_name ?? "—"}`);
      console.log(`   • Régime TVA        : ${profile.vat_regime ?? "—"}`);
      console.log(`   • Préfixes          : ${profile.invoice_prefix ?? "FAC"} / ${profile.credit_note_prefix ?? "AVOIR"}`);
      console.log(`   • Prochains numéros : facture #${profile.next_invoice_number ?? 1} · avoir #${profile.next_credit_note_number ?? 1}`);
      console.log(missing.length ? `   ⚠️  Champs légaux manquants : ${missing.join(", ")}` : "   ✅ Champs légaux essentiels présents.");
    }

    // Statistiques factures
    const total = await n("SELECT COUNT(*)::int n FROM invoices");
    const drafts = await n("SELECT COUNT(*)::int n FROM invoices WHERE status='draft'");
    const issued = await n("SELECT COUNT(*)::int n FROM invoices WHERE status='issued'");
    const paid = await n("SELECT COUNT(*)::int n FROM invoices WHERE status='paid'");
    const credits = await n("SELECT COUNT(*)::int n FROM invoices WHERE type='credit_note'");
    const orphanNum = await n("SELECT COUNT(*)::int n FROM invoices WHERE status<>'draft' AND invoice_number IS NULL");
    const lines = await n("SELECT COUNT(*)::int n FROM invoice_lines");

    console.log("\nFactures :");
    console.log(`   • Total              : ${total}`);
    console.log(`   • Brouillons         : ${drafts}`);
    console.log(`   • Émises             : ${issued}`);
    console.log(`   • Payées             : ${paid}`);
    console.log(`   • Avoirs             : ${credits}`);
    console.log(`   • Lignes             : ${lines}`);
    if (orphanNum > 0) console.log(`   ⚠️  Factures émises SANS numéro : ${orphanNum}`);

    // Doublons de numéro (intégrité)
    const dupNum = await n("SELECT COUNT(*)::int n FROM (SELECT invoice_number FROM invoices WHERE invoice_number IS NOT NULL GROUP BY invoice_number HAVING COUNT(*)>1) d");
    if (dupNum > 0) console.log(`   ⚠️  Numéros de facture en doublon : ${dupNum}`);
    else console.log("   ✅ Numérotation unique.");

    console.log("\n✅ check-billing terminé.");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-billing :", e instanceof Error ? e.message : String(e)); process.exit(1); });
