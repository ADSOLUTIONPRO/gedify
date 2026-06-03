import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import {
  createCalendarEvent,
  listCalendars,
  findSimilarEvents,
  type CalendarEventInput,
} from "@/lib/connectors/google/calendar-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → liste les agendas disponibles */
export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const account = await getActiveGmailAccount();
  if (!account) return NextResponse.json({ error: "Aucun compte Gmail connecté." }, { status: 503 });

  try {
    const calendars = await listCalendars(account.accountId);
    return NextResponse.json({ ok: true, calendars });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.startsWith("CALENDAR_SCOPE_MISSING")) {
      return NextResponse.json(
        { error: msg, errorType: "calendar_scope" },
        { status: 403 },
      );
    }
    return jsonError("Erreur récupération agendas", error);
  }
}

/** POST → créer un événement */
export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: {
    calendarId?: string;
    event: CalendarEventInput;
    checkDuplicates?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!body.event?.summary || !body.event?.start) {
    return NextResponse.json({ error: "event.summary et event.start requis." }, { status: 400 });
  }

  const account = await getActiveGmailAccount();
  if (!account) return NextResponse.json({ error: "Aucun compte Gmail connecté." }, { status: 503 });

  const calendarId = body.calendarId ?? "primary";

  try {
    // Vérification doublons si demandée
    if (body.checkDuplicates) {
      const dateIso = body.event.start.dateTime ?? body.event.start.date ?? "";
      if (dateIso) {
        const similar = await findSimilarEvents(
          account.accountId, calendarId, body.event.summary, dateIso,
        );
        if (similar.length > 0) {
          return NextResponse.json({
            ok: false,
            duplicates: similar,
            message: `${similar.length} événement(s) similaire(s) détecté(s) pour cette date.`,
          });
        }
      }
    }

    const event = await createCalendarEvent(account.accountId, calendarId, body.event);
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.startsWith("CALENDAR_SCOPE_MISSING")) {
      return NextResponse.json({ error: msg, errorType: "calendar_scope" }, { status: 403 });
    }
    return jsonError("Erreur création événement", error);
  }
}
