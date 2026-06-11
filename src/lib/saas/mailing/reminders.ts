import "server-only";

import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { getAppBaseUrl } from "./config";
import { enqueueMail } from "./queue";
import { listTenantMembersWithUser } from "@/lib/tenant/tenant-store";
import { getTenantSubscription, updateSubscriptionStatus } from "@/lib/saas/subscriptions";

/* Relances de paiement automatiques + politique de non-paiement.
   Seuils (jours de retard) :
     - reminder_1   : ≥ 1 jour
     - reminder_2   : ≥ 7 jours
     - reminder_final + bascule "unpaid" : ≥ 14 jours
   Idempotence : une relance par facture et par niveau (dedupe_key). */

export const PAYMENT_POLICY = {
  reminder1Days: 1,
  reminder2Days: 7,
  finalDays: 14,
  graceDays: 7, // mentionné dans la 2e relance
};

function fmtAmount(cents: unknown, currency = "EUR"): string {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} ${currency}`;
}
function daysOverdue(due: unknown): number {
  if (!due) return 0;
  const d = new Date(String(due)).getTime();
  if (!Number.isFinite(d)) return 0;
  return Math.floor((Date.now() - d) / 86_400_000);
}

/** Email de l'owner d'un tenant (repli admin, puis premier membre). */
async function tenantBillingEmail(tenantId: string): Promise<{ email: string; name: string | null } | null> {
  try {
    const members = await listTenantMembersWithUser(tenantId);
    const owner = members.find((m) => m.role === "owner" && m.email)
      ?? members.find((m) => m.role === "admin" && m.email)
      ?? members.find((m) => m.email);
    return owner?.email ? { email: owner.email, name: owner.username } : null;
  } catch {
    return null;
  }
}

export type ReminderRun = { overdue: number; enqueued: number; suspended: number; errors: number };

/** Parcourt les factures émises échues et déclenche relances + blocages. */
export async function runPaymentReminders(): Promise<ReminderRun> {
  const out: ReminderRun = { overdue: 0, enqueued: 0, suspended: 0, errors: 0 };
  if (!postgresActive()) return out;
  const pool = await getPool();

  // Factures "réelles" émises, non payées, non annulées, avec échéance dépassée.
  const { rows } = await pool.query(
    `SELECT id, tenant_id, invoice_number, total_ttc_cents, currency, due_date
       FROM invoices
      WHERE type = 'invoice' AND status = 'issued' AND invoice_number IS NOT NULL
        AND due_date IS NOT NULL AND due_date < now()`,
  );

  for (const inv of rows) {
    const od = daysOverdue(inv.due_date);
    if (od < PAYMENT_POLICY.reminder1Days) continue;
    out.overdue++;
    const tenantId = String(inv.tenant_id);
    const contact = await tenantBillingEmail(tenantId);
    if (!contact) { out.errors++; continue; }

    const number = String(inv.invoice_number);
    const amount = fmtAmount(inv.total_ttc_cents, String(inv.currency ?? "EUR"));
    const invoiceUrl = `${getAppBaseUrl()}/admin/saas/billing/invoices/${inv.id}/pdf`;
    const billingUrl = `${getAppBaseUrl()}/admin/saas/tenant`;
    const dueDate = new Date(String(inv.due_date)).toLocaleDateString("fr-FR");

    let level: "reminder_1" | "reminder_2" | "reminder_final";
    let templateKey: string;
    if (od >= PAYMENT_POLICY.finalDays) { level = "reminder_final"; templateKey = "billing.reminder_final"; }
    else if (od >= PAYMENT_POLICY.reminder2Days) { level = "reminder_2"; templateKey = "billing.reminder_2"; }
    else { level = "reminder_1"; templateKey = "billing.reminder_1"; }

    const res = await enqueueMail({
      to: contact.email,
      toName: contact.name,
      templateKey,
      category: "billing",
      tenantId,
      dedupeKey: `reminder:${inv.id}:${level}`,
      vars: {
        recipientName: contact.name ?? "",
        invoiceNumber: number, amount, dueDate, invoiceUrl, billingUrl,
        graceDays: String(PAYMENT_POLICY.graceDays),
      },
      meta: { invoiceId: String(inv.id), daysOverdue: od, level },
    });
    if (res.status === "queued") out.enqueued++;

    // Politique de non-paiement : au dernier avis, bascule l'abonnement en "unpaid".
    if (od >= PAYMENT_POLICY.finalDays) {
      try {
        const sub = await getTenantSubscription(tenantId);
        if (sub && sub.status !== "unpaid" && sub.status !== "canceled" && sub.status !== "suspended") {
          await updateSubscriptionStatus(tenantId, "unpaid");
          out.suspended++;
          await enqueueMail({
            to: contact.email, toName: contact.name, templateKey: "subscription.suspended",
            category: "subscription", tenantId, dedupeKey: `suspend:${inv.id}`,
            vars: { recipientName: contact.name ?? "", billingUrl },
          });
        }
      } catch {
        out.errors++;
      }
    }
  }
  return out;
}
