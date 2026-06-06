import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/contacts/sync/status → compteurs par source + dernière mise à jour. */
export async function GET() {
  try {
    const account = await getActiveGmailAccount();
    const all = await listEmailContacts();
    const counts = {
      google: all.filter((c) => c.source === "people" || c.source === "other_contacts").length,
      imap_email: all.filter((c) => c.source === "imap_email").length,
      manual: all.filter((c) => c.source === "manual").length,
      total: all.length,
      ignored: all.filter((c) => c.status === "ignored").length,
    };
    const lastSyncAt = all.reduce<string | null>((acc, c) => (acc && acc > c.updatedAt ? acc : c.updatedAt), null);
    return NextResponse.json({
      ok: true,
      account: account ? { accountId: account.accountId, email: account.email } : null,
      counts,
      lastSyncAt,
    });
  } catch (error) {
    return jsonError("Statut de synchronisation indisponible", error);
  }
}
