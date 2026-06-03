import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { readSession } from "@/lib/auth/session";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { createCalendarEvent, type CalendarEventInput } from "@/lib/connectors/google/calendar-api";
import { getDocumentEvent, setDocumentEvent } from "@/lib/documents/document-event-store";
import { appendGedLog } from "@/lib/ged/ged-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Lien d'agenda persistant pour le document (« Ouvrir l'événement »). */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const documentId = Number.parseInt(id, 10);
    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "Identifiant de document invalide." }, { status: 400 });
    }
    const event = await getDocumentEvent(documentId);
    return NextResponse.json({ event });
  } catch (error) {
    return jsonError("Lecture de l'événement du document impossible", error);
  }
}

/** Crée l'événement Google Calendar pour le RDV détecté et persiste le lien. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const documentId = Number.parseInt(id, 10);
    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "Identifiant de document invalide." }, { status: 400 });
    }

    const body = (await request.json()) as {
      summary?: string;
      start?: string;
      location?: string;
      durationMinutes?: number;
    };
    if (!body.summary?.trim() || !body.start) {
      return NextResponse.json({ error: "summary et start requis." }, { status: 400 });
    }

    const account = await getActiveGmailAccount();
    if (!account) {
      return NextResponse.json(
        { error: "no_account", message: "Aucun compte Google connecté pour l'agenda." },
        { status: 503 },
      );
    }

    // L'API Google exige start ET end : on dérive end (+ durée, défaut 60 min).
    const startDate = new Date(body.start);
    const allDay = !body.start.includes("T");
    const event: CalendarEventInput = allDay
      ? {
          summary: body.summary.trim(),
          location: body.location,
          start: { date: body.start.slice(0, 10) },
          end: { date: body.start.slice(0, 10) },
        }
      : {
          summary: body.summary.trim(),
          location: body.location,
          start: { dateTime: startDate.toISOString() },
          end: { dateTime: new Date(startDate.getTime() + (body.durationMinutes ?? 60) * 60_000).toISOString() },
        };

    try {
      const created = await createCalendarEvent(account.accountId, "primary", event);
      const saved = await setDocumentEvent(documentId, {
        eventId: created.id,
        htmlLink: created.htmlLink,
        summary: created.summary,
        start: created.start.dateTime ?? created.start.date ?? body.start,
      });

      const session = await readSession();
      await appendGedLog({
        level: "success",
        source: "GED",
        message: `Événement agenda créé : ${saved.summary}`,
        documentId,
        user: session?.username ?? null,
      }).catch(() => {});

      return NextResponse.json({ event: saved });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.startsWith("CALENDAR_SCOPE_MISSING")) {
        return NextResponse.json({ error: msg, errorType: "calendar_scope" }, { status: 403 });
      }
      throw error;
    }
  } catch (error) {
    return jsonError("Création de l'événement agenda impossible", error);
  }
}
