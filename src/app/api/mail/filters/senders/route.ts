import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mail/filters/senders?q=... — autocomplétion d'expéditeurs.
 * Source : contacts détectés dans les emails (adresses réelles), dédupliqués
 * et normalisés (lowercase). Réponse { items: [{ name, email }] }.
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    const contacts = await listEmailContacts();
    const seen = new Set<string>();
    const items: { name: string; email: string }[] = [];
    for (const c of contacts) {
      if (c.status === "ignored") continue;
      for (const raw of [c.email, ...(c.emails ?? [])]) {
        const email = (raw ?? "").trim().toLowerCase();
        if (!email || seen.has(email)) continue;
        if (q && !`${c.displayName} ${email}`.toLowerCase().includes(q)) continue;
        seen.add(email);
        items.push({ name: c.displayName || email.split("@")[0], email });
        if (items.length >= 20) break;
      }
      if (items.length >= 20) break;
    }
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Autocomplétion expéditeurs impossible", error);
  }
}
