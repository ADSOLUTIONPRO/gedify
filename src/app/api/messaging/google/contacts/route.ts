import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import {
  getEmailContact,
  listEmailContacts,
  setContactCorrespondent,
  upsertEmailContact,
} from "@/lib/messaging/email-contact-store";
import { createPaperlessObject } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody =
  | { action: "link"; resourceName: string; correspondentId: number }
  | { action: "unlink"; resourceName: string }
  | { action: "create-correspondent"; resourceName: string; name: string }
  | {
      action: "edit";
      resourceName: string;
      patch: {
        displayName?: string;
        email?: string | null;
        emails?: string[];
        phone?: string | null;
        organization?: string | null;
      };
    }
  | { action: "ignore"; resourceName: string }
  | { action: "restore"; resourceName: string };

/**
 * Relier / délier / créer un correspondant / éditer un contact (P6 fusion + P7 édition).
 * L'édition est **locale GED** (l'écriture Google Contacts nécessiterait le scope
 * `contacts` en écriture — non demandé).
 */
export async function PATCH(request: NextRequest) {
  try {
    const account = await getActiveGmailAccount();
    if (!account) {
      return NextResponse.json({ error: "no_account", message: "Aucun compte Google connecté." }, { status: 412 });
    }

    const body = (await request.json()) as PatchBody;
    if (!body?.resourceName) {
      return NextResponse.json({ error: "resourceName requis." }, { status: 400 });
    }

    switch (body.action) {
      case "link": {
        const updated = await setContactCorrespondent(body.resourceName, Number(body.correspondentId));
        if (!updated) return NextResponse.json({ error: "Contact introuvable." }, { status: 404 });
        return NextResponse.json({ ok: true, contact: updated });
      }
      case "unlink": {
        const c = await getEmailContact(body.resourceName);
        if (!c) return NextResponse.json({ error: "Contact introuvable." }, { status: 404 });
        const updated = await upsertEmailContact({
          ...c,
          correspondentId: null,
          status: c.suggestedCorrespondentId ? "suggested" : "new",
        });
        return NextResponse.json({ ok: true, contact: updated });
      }
      case "create-correspondent": {
        const name = (body.name ?? "").trim();
        if (!name) return NextResponse.json({ error: "Nom du correspondant requis." }, { status: 400 });
        const created = await createPaperlessObject<{ id: number; name: string }>("/api/correspondents/", { name });
        const updated = await setContactCorrespondent(body.resourceName, Number(created.id));
        return NextResponse.json({ ok: true, contact: updated, correspondent: created });
      }
      case "edit": {
        const c = await getEmailContact(body.resourceName);
        if (!c) return NextResponse.json({ error: "Contact introuvable." }, { status: 404 });
        const p = body.patch ?? {};
        const updated = await upsertEmailContact({
          ...c,
          displayName: typeof p.displayName === "string" && p.displayName.trim() ? p.displayName.trim() : c.displayName,
          email: p.email !== undefined ? p.email : c.email,
          emails: Array.isArray(p.emails) ? p.emails : c.emails,
          phone: p.phone !== undefined ? p.phone : c.phone,
          organization: p.organization !== undefined ? p.organization : c.organization,
        });
        return NextResponse.json({ ok: true, contact: updated });
      }
      case "ignore": {
        const c = await getEmailContact(body.resourceName);
        if (!c) return NextResponse.json({ error: "Contact introuvable." }, { status: 404 });
        const updated = await upsertEmailContact({ ...c, status: "ignored" });
        return NextResponse.json({ ok: true, contact: updated });
      }
      case "restore": {
        const c = await getEmailContact(body.resourceName);
        if (!c) return NextResponse.json({ error: "Contact introuvable." }, { status: 404 });
        const status = c.correspondentId ? "linked" : c.suggestedCorrespondentId ? "suggested" : "new";
        const updated = await upsertEmailContact({ ...c, status });
        return NextResponse.json({ ok: true, contact: updated });
      }
      default:
        return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }
  } catch (error) {
    return jsonError("Mise à jour du contact impossible", error);
  }
}

export async function GET() {
  try {
    const account = await getActiveGmailAccount();
    if (!account) {
      return NextResponse.json(
        { error: "no_account", message: "Aucun compte Google connecté." },
        { status: 412 },
      );
    }
    const contacts = await listEmailContacts(account.accountId);
    return NextResponse.json({
      accountId: account.accountId,
      accountEmail: account.email,
      contacts,
    });
  } catch (error) {
    return jsonError("Lecture des contacts Google impossible", error);
  }
}
