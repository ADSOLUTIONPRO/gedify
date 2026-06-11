/* saas:check-support — état du support humain (lecture seule).
   Statistiques des conversations, SLA, et contrôle d'isolation tenant
   (toute conversation/message doit porter un tenant_id). N'écrit rien. */

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

    const total = await n("SELECT COUNT(*)::int n FROM support_conversations");
    const open = await n("SELECT COUNT(*)::int n FROM support_conversations WHERE status='open'");
    const pending = await n("SELECT COUNT(*)::int n FROM support_conversations WHERE status='pending'");
    const resolved = await n("SELECT COUNT(*)::int n FROM support_conversations WHERE status IN ('resolved','closed')");
    const unassigned = await n("SELECT COUNT(*)::int n FROM support_conversations WHERE assigned_to_user_id IS NULL AND status NOT IN ('resolved','closed')");
    const breached = await n("SELECT COUNT(*)::int n FROM support_conversations WHERE sla_due_at IS NOT NULL AND first_response_at IS NULL AND sla_due_at < now() AND status NOT IN ('resolved','closed')");
    const messages = await n("SELECT COUNT(*)::int n FROM support_messages");
    const internal = await n("SELECT COUNT(*)::int n FROM support_messages WHERE is_internal = true");
    const sla = await n("SELECT COUNT(*)::int n FROM support_sla_policies");
    const canned = await n("SELECT COUNT(*)::int n FROM support_canned_replies");

    console.log("Support :");
    console.log(`   • Conversations         : ${total}`);
    console.log(`   • Ouvertes / à traiter  : ${open} / ${pending}`);
    console.log(`   • Résolues / clôturées  : ${resolved}`);
    console.log(`   • Non assignées         : ${unassigned}`);
    console.log(`   • Messages (dont notes internes) : ${messages} (${internal})`);
    console.log(`   • Politiques SLA        : ${sla}`);
    console.log(`   • Réponses types        : ${canned}`);
    if (breached > 0) console.log(`   ⚠️  SLA de 1re réponse dépassé : ${breached}`);

    // Contrôle d'isolation : aucune ligne sans tenant_id.
    const convNoTenant = await n("SELECT COUNT(*)::int n FROM support_conversations WHERE tenant_id IS NULL OR tenant_id = ''");
    const msgNoTenant = await n("SELECT COUNT(*)::int n FROM support_messages WHERE tenant_id IS NULL OR tenant_id = ''");
    const orphanMsg = await n("SELECT COUNT(*)::int n FROM support_messages m LEFT JOIN support_conversations c ON c.id = m.conversation_id WHERE c.id IS NULL");
    const mismatch = await n("SELECT COUNT(*)::int n FROM support_messages m JOIN support_conversations c ON c.id = m.conversation_id WHERE m.tenant_id <> c.tenant_id");

    console.log("\nIsolation tenant :");
    console.log(`   ${convNoTenant === 0 ? "✅" : "⚠️ "} Conversations sans tenant : ${convNoTenant}`);
    console.log(`   ${msgNoTenant === 0 ? "✅" : "⚠️ "} Messages sans tenant      : ${msgNoTenant}`);
    console.log(`   ${orphanMsg === 0 ? "✅" : "⚠️ "} Messages orphelins         : ${orphanMsg}`);
    console.log(`   ${mismatch === 0 ? "✅" : "⚠️ "} Tenant message≠conversation : ${mismatch}`);

    if (sla === 0) console.log("\n   ⚠️  Aucune politique SLA — initialisez-les via /admin/saas/support/settings.");
    console.log("\n✅ check-support terminé.");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-support :", e instanceof Error ? e.message : String(e)); process.exit(1); });
