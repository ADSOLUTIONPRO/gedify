import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { deleteEvent, getEvent, updateEvent, type CalendarEventInput } from "@/lib/calendar/calendar-event-store";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { deleteEventFromGoogle, pushEventToGoogle } from "@/lib/calendar/google-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function uid(req: NextRequest): Promise<string | { deny: NextResponse }> {
  const deny = await requireAuth(req);
  if (deny) return { deny };
  const user = await getCurrentUser();
  return user ? String(user.id) : "local";
}

/** GET /api/calendar/events/:id — un événement (si propriétaire). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    const { id } = await params;
    const event = await getEvent(u, id);
    if (!event) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
    return NextResponse.json({ event });
  } catch (error) {
    return jsonError("Événement indisponible.", error);
  }
}

/** PATCH /api/calendar/events/:id — modifie un événement. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    const { id } = await params;
    const patch = (await req.json().catch(() => ({}))) as Partial<CalendarEventInput>;
    let event = await updateEvent(u, id, patch);
    if (!event) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
    // Propage la modification vers Google si l'événement y est synchronisé.
    if (event.provider === "google" && event.externalId && event.calendarId && event.calendarId !== "local") {
      try {
        const account = await getActiveGmailAccount();
        if (account) {
          await pushEventToGoogle(account.accountId, event.calendarId, event);
          event = (await updateEvent(u, id, { syncStatus: "synced", lastSyncedAt: new Date().toISOString() })) ?? event;
        }
      } catch (e) {
        event = (await updateEvent(u, id, { syncStatus: "error", syncError: e instanceof Error ? e.message : "push" })) ?? event;
      }
    }
    return NextResponse.json({ event });
  } catch (error) {
    return jsonError("Mise à jour impossible.", error);
  }
}

/** DELETE /api/calendar/events/:id — supprime un événement. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    const { id } = await params;
    const existing = await getEvent(u, id);
    const ok = await deleteEvent(u, id);
    if (!ok) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
    // Supprime aussi côté Google si l'événement y était synchronisé (best-effort).
    if (existing?.provider === "google" && existing.externalId && existing.calendarId && existing.calendarId !== "local") {
      try {
        const account = await getActiveGmailAccount();
        if (account) await deleteEventFromGoogle(account.accountId, existing.calendarId, existing.externalId);
      } catch {
        /* l'événement local est déjà supprimé ; l'écart Google sera résorbé au prochain pull. */
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression impossible.", error);
  }
}
