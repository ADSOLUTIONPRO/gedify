import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { jsonError } from "@/lib/api-utils";
import {
  listEmailContacts,
  upsertEmailContact,
  removeEmailContact,
  getEmailContact,
} from "@/lib/messaging/email-contact-store";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { normalizeEmail } from "@/lib/contacts/eligible-contacts";
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

/**
 * PATCH /api/contacts → met à jour un contact.
 *
 * `resourceName` peut être :
 *  - un identifiant de fiche existante (`people/…`, `manual:…`, `email:…`) ;
 *  - une ADRESSE EMAIL (cas des contacts agrégés « liés à la GED », dont l'id
 *    EST l'email) : on retrouve alors la fiche par email, ou on crée une fiche
 *    d'override `email:<email>` (jamais écrasée par la synchro).
 *
 * Tout enregistrement édité ici est marqué `manuallyEdited` → ses champs sont
 * préservés lors des prochaines synchronisations.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      resourceName?: string;
      displayName?: string;
      email?: string | null;
      emails?: string[];
      phone?: string | null;
      organization?: string | null;
      address?: string | null;
      notes?: string | null;
    };
    const idRaw = (body.resourceName ?? "").trim();
    if (!idRaw) return NextResponse.json({ error: "Identifiant de contact requis." }, { status: 400 });

    // 1) Fiche existante par resourceName.
    let existing = await getEmailContact(idRaw);

    // 2) Sinon, l'id est probablement une adresse email (contact agrégé) :
    //    on tente de retrouver une fiche portant cet email.
    const idEmail = idRaw.includes("@") ? normalizeEmail(idRaw) : "";
    if (!existing && idEmail) {
      const all = await listEmailContacts();
      existing =
        all.find((c) => normalizeEmail(c.email) === idEmail || (c.emails ?? []).some((e) => normalizeEmail(e) === idEmail)) ?? null;
    }

    const emails = Array.isArray(body.emails)
      ? body.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
      : existing?.emails ?? (idEmail ? [idEmail] : []);
    const primaryEmail =
      typeof body.email === "string"
        ? (body.email.trim().toLowerCase() || null)
        : emails[0] ?? existing?.email ?? (idEmail || null);

    if (existing) {
      // Mise à jour de la fiche existante (édition protégée).
      const next: EmailContactRecord = {
        ...existing,
        displayName: typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : existing.displayName,
        email: primaryEmail,
        emails: emails.length ? Array.from(new Set(emails)) : (primaryEmail ? [primaryEmail] : []),
        phone: body.phone !== undefined ? (typeof body.phone === "string" ? body.phone.trim() || null : null) : existing.phone,
        organization: body.organization !== undefined ? (typeof body.organization === "string" ? body.organization.trim() || null : null) : existing.organization,
        address: body.address !== undefined ? (typeof body.address === "string" ? body.address.trim() || null : null) : (existing.address ?? null),
        notes: body.notes !== undefined ? (typeof body.notes === "string" ? body.notes.trim() || null : null) : (existing.notes ?? null),
        manuallyEdited: true,
      };
      const updated = await upsertEmailContact(next);
      return NextResponse.json({ ok: true, contact: updated });
    }

    // 3) Aucune fiche → on crée un override d'édition keyé par email.
    if (!primaryEmail && emails.length === 0) {
      return NextResponse.json({ error: "Contact introuvable (email requis pour créer la fiche)." }, { status: 404 });
    }
    const account = await getActiveGmailAccount();
    const created = await upsertEmailContact({
      resourceName: `email:${primaryEmail ?? emails[0]}`,
      accountId: account?.accountId ?? "local",
      accountEmail: account?.email ?? "",
      displayName: (typeof body.displayName === "string" && body.displayName.trim()) || (primaryEmail ?? emails[0]).split("@")[0],
      email: primaryEmail,
      emails: emails.length ? Array.from(new Set(emails)) : (primaryEmail ? [primaryEmail] : []),
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      organization: typeof body.organization === "string" ? body.organization.trim() || null : null,
      address: typeof body.address === "string" ? body.address.trim() || null : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      source: "manual",
      correspondentId: null,
      suggestedCorrespondentId: null,
      suggestedScore: null,
      status: "manual",
      manuallyEdited: true,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, contact: created });
  } catch (error) {
    return jsonError("Mise à jour du contact impossible", error);
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
