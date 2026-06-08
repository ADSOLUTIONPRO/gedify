import "server-only";

import { randomUUID } from "node:crypto";
import { deleteEvent as davDelete, listCalendarObjects, putEvent, type CalDavAuth } from "@/lib/connectors/caldav/caldav-client";
import { buildICS, parseICS, type ICalEvent } from "@/lib/connectors/caldav/ical";
import { getCalDavAuth } from "@/lib/connectors/caldav/caldav-credentials-store";
import { upsertByExternal, type CalendarEvent } from "@/lib/calendar/calendar-event-store";

/* Synchro CalDAV (iCloud) ↔ socle CalendarEvent. PULL : importe les VEVENT des
   agendas connectés (provider=icloud, externalId=URL de l'objet .ics). PUSH :
   PUT/DELETE des .ics. iCalendar minimal (cf. ical.ts). */

export type CalDavSyncReport = { imported: number; updated: number; calendars: number; errors: string[] };

/** PULL : importe les événements iCloud d'un compte dans le socle. */
export async function pullCalDav(userId: string, accountId: string, range: { from: string; to: string }): Promise<CalDavSyncReport> {
  const report: CalDavSyncReport = { imported: 0, updated: 0, calendars: 0, errors: [] };
  const account = await getCalDavAuth(accountId);
  if (!account) { report.errors.push("Compte CalDAV introuvable."); return report; }
  const auth: CalDavAuth = { username: account.username, password: account.password };
  report.calendars = account.calendars.length;

  for (const cal of account.calendars) {
    try {
      const objects = await listCalendarObjects(cal.url, auth, range.from, range.to);
      for (const obj of objects) {
        const vevents = parseICS(obj.ics);
        const ev = vevents[0];
        if (!ev) continue;
        const { created } = await upsertByExternal(userId, "icloud", obj.href, {
          title: ev.summary,
          description: ev.description ?? null,
          start: ev.start,
          end: ev.end,
          allDay: ev.allDay,
          location: ev.location ? { displayName: ev.location } : null,
          recurrence: ev.rrule ?? null,
          calendarId: cal.url,
          etag: obj.etag,
          syncStatus: "synced",
          lastSyncedAt: new Date().toISOString(),
          createdAutomatically: true,
          sourceType: "auto",
          sourceLabel: `iCloud · ${cal.displayName}`,
        });
        if (created) report.imported += 1; else report.updated += 1;
      }
    } catch (e) {
      report.errors.push(`${cal.displayName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return report;
}

function mapEventToICal(event: CalendarEvent, uid: string): ICalEvent {
  return {
    uid,
    summary: event.title,
    description: event.description ?? null,
    location: event.location?.displayName ?? event.location?.formattedAddress ?? null,
    start: event.start,
    end: event.end ?? event.start,
    allDay: event.allDay,
    rrule: event.recurrence ?? null,
  };
}

/**
 * PUSH : crée ou met à jour l'événement chez CalDAV. Renvoie l'URL de l'objet
 * (externalId) et l'etag. `calendarUrl` = agenda cible (= event.calendarId).
 */
export async function pushEventToCalDav(
  auth: CalDavAuth,
  calendarUrl: string,
  event: CalendarEvent,
): Promise<{ externalId: string; etag: string | null }> {
  // Objet existant → réutilise son URL ; sinon nouvelle ressource .ics.
  const isExisting = Boolean(event.externalId && event.externalId.startsWith("http"));
  const uid = isExisting ? (event.externalId!.split("/").pop()?.replace(/\.ics$/i, "") ?? randomUUID()) : `${randomUUID()}@gedify`;
  const url = isExisting ? event.externalId! : `${calendarUrl.replace(/\/?$/, "/")}${uid}.ics`;
  const ics = buildICS(mapEventToICal(event, uid));
  const { etag } = await putEvent(url, ics, auth, isExisting ? event.etag ?? undefined : undefined);
  return { externalId: url, etag };
}

/** DELETE : supprime l'objet CalDAV. */
export async function deleteEventFromCalDav(auth: CalDavAuth, externalId: string, etag?: string | null): Promise<void> {
  await davDelete(externalId, auth, etag ?? undefined);
}
