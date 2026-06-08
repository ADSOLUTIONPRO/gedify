import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createEvent, listEvents, updateEvent, type CalendarEventInput } from "@/lib/calendar/calendar-event-store";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { pushEventToGoogle } from "@/lib/calendar/google-sync";
import { getCalDavAccountForCalendar } from "@/lib/connectors/caldav/caldav-credentials-store";
import { pushEventToCalDav } from "@/lib/calendar/caldav-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function uid(req: NextRequest): Promise<string | { deny: NextResponse }> {
  const deny = await requireAuth(req);
  if (deny) return { deny };
  const user = await getCurrentUser();
  return user ? String(user.id) : "local";
}

/** GET /api/calendar/events?from=&to= — événements de l'utilisateur (par plage). */
export async function GET(req: NextRequest) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    const from = req.nextUrl.searchParams.get("from") ?? undefined;
    const to = req.nextUrl.searchParams.get("to") ?? undefined;
    const events = await listEvents(u, { from, to });
    return NextResponse.json({ events });
  } catch (error) {
    return jsonError("Événements indisponibles.", error);
  }
}

/** POST /api/calendar/events — crée un événement. */
export async function POST(req: NextRequest) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    const body = (await req.json().catch(() => ({}))) as CalendarEventInput;
    if (!body.title?.trim() || !body.start) {
      return NextResponse.json({ error: "title et start requis." }, { status: 400 });
    }
    const requestConference = Boolean((body as Record<string, unknown>).requestConference);
    let event = await createEvent(u, body);
    // Synchro GEDify → Google : si l'agenda cible est un agenda Google, créer
    // l'événement chez Google et mémoriser son externalId (bidirectionnel).
    if (event.calendarId && event.calendarId !== "local") {
      const dav = await getCalDavAccountForCalendar(event.calendarId);
      try {
        if (dav) {
          // Agenda CalDAV (iCloud) → PUT de l'objet .ics.
          const { externalId, etag } = await pushEventToCalDav({ username: dav.username, password: dav.password }, event.calendarId, event);
          event = (await updateEvent(u, event.id, { provider: "icloud", externalId, etag, syncStatus: "synced", lastSyncedAt: new Date().toISOString() })) ?? event;
        } else {
          // Sinon agenda Google.
          const account = await getActiveGmailAccount();
          if (account) {
            const { externalId, conferenceUrl } = await pushEventToGoogle(account.accountId, event.calendarId, event, { requestConference });
            event = (await updateEvent(u, event.id, { provider: "google", externalId, conferenceUrl: conferenceUrl ?? event.conferenceUrl, syncStatus: "synced", lastSyncedAt: new Date().toISOString() })) ?? event;
          }
        }
      } catch (e) {
        event = (await updateEvent(u, event.id, { syncStatus: "error", syncError: e instanceof Error ? e.message : "push" })) ?? event;
      }
    }
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return jsonError("Création de l'événement impossible.", error);
  }
}
