import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createEvent, listEvents, type CalendarEventInput } from "@/lib/calendar/calendar-event-store";

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
    const event = await createEvent(u, body);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return jsonError("Création de l'événement impossible.", error);
  }
}
