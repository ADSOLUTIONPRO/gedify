import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { listGmailLabels } from "@/lib/connectors/gmail/gmail-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Libellés système masqués (techniques) ou déjà couverts par les dossiers logiques. */
const HIDDEN = new Set(["CHAT", "SENT", "DRAFT", "TRASH", "SPAM", "UNREAD", "STARRED", "IMPORTANT", "INBOX"]);

/**
 * GET /api/mail/filters/labels?q=... — autocomplétion de labels/dossiers d'origine.
 * Source : labels Gmail réels du compte actif. Réponse { items: [{ id, name }] }.
 */
export async function GET(req: NextRequest) {
  try {
    const account = await getActiveGmailAccount();
    if (!account) return NextResponse.json({ items: [] });
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    const labels = await listGmailLabels(account.accountId);
    const items = labels
      .filter((l) => !HIDDEN.has(l.id) && !l.id.startsWith("CATEGORY_"))
      .filter((l) => (q ? l.name.toLowerCase().includes(q) : true))
      .slice(0, 20)
      .map((l) => ({ id: l.id, name: l.name }));
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplétion labels impossible", error);
  }
}
