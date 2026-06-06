import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { jsonError } from "@/lib/api-utils";
import {
  listEmailContacts,
  upsertEmailContact,
  removeEmailContact,
} from "@/lib/messaging/email-contact-store";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import type { EmailContactRecord } from "@/lib/messaging/email-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_GROUPS: Record<string, EmailContactRecord["source"][]> = {
  google: ["people", "other_contacts"],
  imap_email: ["imap_email"],
  manual: ["manual"],
};

/** GET /api/contacts?sources=google,imap_email,manual → liste unifiée multi-sources. */
export async function GET(req: NextRequest) {
  try {
    const raw = (req.nextUrl.searchParams.get("sources") ?? "").trim();
    const wanted = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const allowed = new Set<EmailContactRecord["source"]>();
    if (wanted.length === 0) {
      for (const list of Object.values(SOURCE_GROUPS)) list.forEach((s) => allowed.add(s));
    } else {
      for (const w of wanted) (SOURCE_GROUPS[w] ?? []).forEach((s) => allowed.add(s));
    }
    const all = await listEmailContacts();
    const items = all.filter((c) => c.status !== "ignored" && allowed.has(c.source));
    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (error) {
    return jsonError("Lecture des contacts impossible", error);
  }
}

/** POST /api/contacts → crée un contact MANUEL (ou depuis un correspondant). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      displayName?: string;
      email?: string | null;
      phone?: string | null;
      organization?: string | null;
      correspondentId?: number | null;
    };
    const displayName = (body.displayName ?? "").trim();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    if (!displayName && !email) {
      return NextResponse.json({ error: "Nom ou email requis." }, { status: 400 });
    }
    const account = await getActiveGmailAccount();
    const now = new Date().toISOString();
    const record: EmailContactRecord = {
      resourceName: `manual:${randomUUID()}`,
      accountId: account?.accountId ?? "local",
      accountEmail: account?.email ?? "",
      displayName: displayName || (email ? email.split("@")[0] : "Contact"),
      email,
      emails: email ? [email] : [],
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      organization: typeof body.organization === "string" ? body.organization.trim() || null : null,
      source: "manual",
      correspondentId: typeof body.correspondentId === "number" ? body.correspondentId : null,
      suggestedCorrespondentId: null,
      suggestedScore: null,
      status: typeof body.correspondentId === "number" ? "linked" : "manual",
      updatedAt: now,
    };
    const created = await upsertEmailContact(record);
    return NextResponse.json({ ok: true, contact: created });
  } catch (error) {
    return jsonError("Création du contact impossible", error);
  }
}

/** DELETE /api/contacts?resourceName=... → supprime un contact. */
export async function DELETE(req: NextRequest) {
  try {
    const resourceName = req.nextUrl.searchParams.get("resourceName") ?? "";
    if (!resourceName) return NextResponse.json({ error: "resourceName requis." }, { status: 400 });
    const ok = await removeEmailContact(resourceName);
    if (!ok) return NextResponse.json({ error: "Contact introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression du contact impossible", error);
  }
}
