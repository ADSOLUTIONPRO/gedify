import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { deleteEvent, getEvent, updateEvent, type CalendarEventInput } from "@/lib/calendar/calendar-event-store";

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
    const event = await updateEvent(u, id, patch);
    if (!event) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
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
    const ok = await deleteEvent(u, id);
    if (!ok) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression impossible.", error);
  }
}
