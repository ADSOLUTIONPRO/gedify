import "server-only";

import { getAccessTokenForAccount } from "@/lib/connectors/gmail/gmail-api";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

async function calendarFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${CALENDAR_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const status = response.status;
    if (status === 403) {
      throw new Error(
        `CALENDAR_SCOPE_MISSING: L'accès Google Calendar nécessite le scope calendar.events. ` +
        `Reconnectez votre compte Gmail avec ce scope activé.`,
      );
    }
    throw new Error(`Calendar API ${status} on ${path}: ${text}`);
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarEventDateTime = {
  dateTime?: string; // ISO 8601 avec timezone
  date?: string;     // date seule si journée entière
  timeZone?: string;
};

export type ConferenceData = {
  createRequest?: { requestId: string; conferenceSolutionKey: { type: string } };
  entryPoints?: { entryPointType: string; uri: string; label?: string }[];
};

export type CalendarEventInput = {
  summary: string;
  description?: string;
  location?: string;
  start: CalendarEventDateTime;
  end: CalendarEventDateTime;
  attendees?: { email: string; displayName?: string }[];
  reminders?: {
    useDefault?: boolean;
    overrides?: { method: "email" | "popup"; minutes: number }[];
  };
  recurrence?: string[];           // ex. ["RRULE:FREQ=WEEKLY"]
  visibility?: string;             // default | public | private
  transparency?: string;           // opaque (occupé) | transparent (disponible)
  conferenceData?: ConferenceData; // Google Meet
};

export type CalendarEvent = CalendarEventInput & {
  id: string;
  htmlLink: string;
  status: string;
  created: string;
  updated: string;
  organizer: { email: string; displayName?: string };
  hangoutLink?: string;
};

export type CalendarListEntry = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
};

// ---------------------------------------------------------------------------
// List calendars
// ---------------------------------------------------------------------------

export async function listCalendars(accountId: string): Promise<CalendarListEntry[]> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const data = await calendarFetch<{ items?: CalendarListEntry[] }>(
    accessToken,
    "/users/me/calendarList",
  );
  return data.items ?? [];
}

// ---------------------------------------------------------------------------
// Create event
// ---------------------------------------------------------------------------

export async function createCalendarEvent(
  accountId: string,
  calendarId: string,
  event: CalendarEventInput,
): Promise<CalendarEvent> {
  const accessToken = await getAccessTokenForAccount(accountId);
  // conferenceDataVersion=1 requis dès qu'on demande la création d'un Meet.
  const conf = event.conferenceData ? "?conferenceDataVersion=1" : "";
  return calendarFetch<CalendarEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events${conf}`,
    {
      method: "POST",
      body: JSON.stringify(event),
    },
  );
}

// ---------------------------------------------------------------------------
// List events (lecture) — pour la synchro Google → GEDify
// ---------------------------------------------------------------------------

export async function listCalendarEvents(
  accountId: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const data = await calendarFetch<{ items?: CalendarEvent[] }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );
  return data.items ?? [];
}

// ---------------------------------------------------------------------------
// Update / Delete event (écriture — synchro GEDify → Google)
// ---------------------------------------------------------------------------

export async function updateCalendarEvent(
  accountId: string,
  calendarId: string,
  eventId: string,
  event: Partial<CalendarEventInput>,
): Promise<CalendarEvent> {
  const accessToken = await getAccessTokenForAccount(accountId);
  return calendarFetch<CalendarEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(event) },
  );
}

export async function deleteCalendarEvent(accountId: string, calendarId: string, eventId: string): Promise<void> {
  const accessToken = await getAccessTokenForAccount(accountId);
  await calendarFetch<null>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
}

// ---------------------------------------------------------------------------
// Check for duplicates (same date + title proximity)
// ---------------------------------------------------------------------------

export async function findSimilarEvents(
  accountId: string,
  calendarId: string,
  title: string,
  dateIso: string,
): Promise<CalendarEvent[]> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const day = dateIso.slice(0, 10);
  const timeMin = `${day}T00:00:00Z`;
  const timeMax = `${day}T23:59:59Z`;
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    maxResults: "20",
  });
  const data = await calendarFetch<{ items?: CalendarEvent[] }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );
  const events = data.items ?? [];
  const titleLower = title.toLowerCase();
  return events.filter((e) =>
    e.summary?.toLowerCase().includes(titleLower.slice(0, 10)) ||
    titleLower.includes((e.summary ?? "").toLowerCase().slice(0, 10)),
  );
}
