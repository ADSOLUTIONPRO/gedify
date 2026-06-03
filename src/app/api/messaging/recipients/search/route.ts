import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type RecipientSuggestion = {
  name: string;
  email: string;
  /** "linked" = contact Google relié à un correspondant GED. */
  source: "google" | "linked";
  correspondentId: number | null;
};

/**
 * Recherche de destinataires : contacts Google (avec liaison correspondant GED
 * quand elle existe). Les correspondants Gedify purs n'ont pas d'email stocké,
 * donc la source fiable reste les contacts Google.
 */
export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim();
  if (q.length < 1) return NextResponse.json({ suggestions: [] });

  try {
    const account = await getActiveGmailAccount();
    if (!account) return NextResponse.json({ suggestions: [] });

    const contacts = await listEmailContacts(account.accountId);
    const out: RecipientSuggestion[] = [];
    const seen = new Set<string>();

    for (const contact of contacts) {
      const emails = [contact.email, ...(contact.emails ?? [])].filter((e): e is string => !!e);
      const name = contact.displayName || emails[0] || "";
      for (const email of emails) {
        const key = email.toLowerCase();
        if (seen.has(key)) continue;
        if (!name.toLowerCase().includes(q) && !key.includes(q)) continue;
        seen.add(key);
        out.push({
          name: name || email,
          email,
          source: contact.correspondentId ? "linked" : "google",
          correspondentId: contact.correspondentId ?? null,
        });
        if (out.length >= 8) break;
      }
      if (out.length >= 8) break;
    }

    return NextResponse.json({ suggestions: out });
  } catch (error) {
    return jsonError("Recherche des destinataires impossible", error);
  }
}
