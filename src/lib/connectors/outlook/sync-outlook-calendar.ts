import "server-only";

import { upsertByExternal } from "@/lib/calendar/calendar-event-store";
import { listEvents } from "./graph-api";

/* Importe les événements d'agenda Microsoft (Graph /me/calendarView) dans le
   socle CalendarEvent (provider=outlook, externalId) → idempotent via upsert,
   pas de doublon. Mêmes conventions que la synchro Google (pullGoogleEvents). */

export type OutlookCalendarReport = { imported: number; updated: number; errors: string[] };

function graphDateToISO(dt?: { dateTime?: string; date?: string } | null): string | null {
  if (!dt) return null;
  if (dt.date) return new Date(`${dt.date}T00:00:00Z`).toISOString();
  if (dt.dateTime) {
    // Graph renvoie un dateTime sans offset (UTC par défaut côté serveur).
    const raw = /[zZ]|[+-]\d\d:\d\d$/.test(dt.dateTime) ? dt.dateTime : `${dt.dateTime}Z`;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export async function pullOutlookEvents(
  userId: string,
  accountId: string,
  range: { from: string; to: string },
): Promise<OutlookCalendarReport> {
  const report: OutlookCalendarReport = { imported: 0, updated: 0, errors: [] };
  let events;
  try {
    events = await listEvents(accountId, range.from, range.to);
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : String(e));
    return report;
  }

  for (const ev of events) {
    try {
      if (ev.isCancelled) continue;
      const start = graphDateToISO(ev.start);
      if (!start) continue;
      const { created } = await upsertByExternal(userId, "outlook", ev.id, {
        title: ev.subject ?? "(sans titre)",
        description: ev.bodyPreview ?? null,
        start,
        end: graphDateToISO(ev.end),
        allDay: Boolean(ev.isAllDay),
        location: ev.location?.displayName ? { displayName: ev.location.displayName } : null,
        conferenceUrl: ev.onlineMeeting?.joinUrl ?? null,
        participants: (ev.attendees ?? [])
          .map((a) => ({ email: a.emailAddress?.address ?? "", name: a.emailAddress?.name ?? null }))
          .filter((p) => p.email),
        syncStatus: "synced",
        lastSyncedAt: new Date().toISOString(),
        createdAutomatically: true,
        sourceType: "auto",
        sourceLabel: "Microsoft",
      });
      if (created) report.imported += 1; else report.updated += 1;
    } catch (e) {
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return report;
}
