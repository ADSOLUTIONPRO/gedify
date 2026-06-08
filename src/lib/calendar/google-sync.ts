import "server-only";

import { createCalendarEvent, deleteCalendarEvent, listCalendars, listCalendarEvents, updateCalendarEvent, type CalendarEventInput } from "@/lib/connectors/google/calendar-api";
import { upsertByExternal, type CalendarEvent } from "@/lib/calendar/calendar-event-store";

/* ────────────────────────────────────────────────────────────────────────
   Synchro Google Agenda → GEDify (PULL). Importe les événements des agendas
   Google connectés dans le socle CalendarEvent (provider=google, externalId)
   → évite les doublons via upsert. Le PUSH (GEDify → Google) réutilise déjà
   createCalendarEvent ; la synchro complète bidirectionnelle (conflits, etag,
   autres fournisseurs) reste à brancher avec des comptes de test.
   ──────────────────────────────────────────────────────────────────────── */

export type GoogleSyncReport = { imported: number; updated: number; calendars: number; errors: string[] };

/* ── PUSH : GEDify → Google (création / mise à jour / suppression) ────────── */

function toGoogleDateTime(iso: string, allDay: boolean, addDay = false): { date?: string; dateTime?: string } {
  if (allDay) {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
    if (addDay) d.setDate(d.getDate() + 1); // fin all-day exclusive côté Google
    return { date: d.toISOString().slice(0, 10) };
  }
  return { dateTime: new Date(iso).toISOString() };
}

function mapEventToGoogle(event: CalendarEvent): CalendarEventInput {
  const endIso = event.end ?? event.start;
  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location?.displayName ?? event.location?.formattedAddress ?? undefined,
    start: toGoogleDateTime(event.start, event.allDay),
    end: toGoogleDateTime(endIso, event.allDay, event.allDay),
    attendees: event.participants?.length ? event.participants.map((p) => ({ email: p.email, displayName: p.name ?? undefined })) : undefined,
    reminders: event.reminders?.length
      ? { useDefault: false, overrides: event.reminders.map((r) => ({ method: r.channel === "email" ? "email" : "popup", minutes: r.minutesBefore })) }
      : undefined,
  };
}

/** Crée ou met à jour l'événement sur Google. Renvoie l'externalId. */
export async function pushEventToGoogle(accountId: string, calendarId: string, event: CalendarEvent): Promise<string> {
  const payload = mapEventToGoogle(event);
  if (event.externalId) {
    const updated = await updateCalendarEvent(accountId, calendarId, event.externalId, payload);
    return updated.id;
  }
  const created = await createCalendarEvent(accountId, calendarId, payload);
  return created.id;
}

export async function deleteEventFromGoogle(accountId: string, calendarId: string, externalId: string): Promise<void> {
  await deleteCalendarEvent(accountId, calendarId, externalId);
}

function startToISO(dt?: { dateTime?: string; date?: string }): string | null {
  if (!dt) return null;
  if (dt.dateTime) return dt.dateTime;
  if (dt.date) return `${dt.date}T00:00:00`;
  return null;
}

export async function pullGoogleEvents(
  userId: string,
  accountId: string,
  range: { from: string; to: string },
): Promise<GoogleSyncReport> {
  const report: GoogleSyncReport = { imported: 0, updated: 0, calendars: 0, errors: [] };

  let calendars;
  try {
    calendars = await listCalendars(accountId);
  } catch {
    // Scope liste indisponible → on tente au moins l'agenda principal.
    calendars = [{ id: "primary", summary: "Principal", accessRole: "owner" }];
  }
  report.calendars = calendars.length;

  for (const cal of calendars) {
    try {
      const events = await listCalendarEvents(accountId, cal.id, range.from, range.to);
      for (const ev of events) {
        if (ev.status === "cancelled") continue;
        const start = startToISO(ev.start);
        if (!start) continue;
        const allDay = Boolean(ev.start?.date);
        const { created } = await upsertByExternal(userId, "google", ev.id, {
          title: ev.summary ?? "(sans titre)",
          description: ev.description ?? null,
          start,
          end: startToISO(ev.end),
          allDay,
          location: ev.location ? { displayName: ev.location } : null,
          calendarId: cal.id,
          participants: (ev.attendees ?? []).map((a) => ({ email: a.email, name: a.displayName ?? null })),
          syncStatus: "synced",
          lastSyncedAt: new Date().toISOString(),
          createdAutomatically: true,
          sourceType: "auto",
          sourceLabel: `Google · ${cal.summary}`,
        });
        if (created) report.imported += 1; else report.updated += 1;
      }
    } catch (e) {
      report.errors.push(`${cal.summary}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return report;
}
