import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createView, listViews } from "@/lib/documents/saved-views-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function uid(req: NextRequest): Promise<string | { deny: NextResponse }> {
  const deny = await requireAuth(req);
  if (deny) return { deny };
  const user = await getCurrentUser();
  return user ? String(user.id) : "local";
}

/** GET /api/document-views — vues enregistrées de l'utilisateur. */
export async function GET(req: NextRequest) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    return NextResponse.json({ views: await listViews(u) });
  } catch (error) {
    return jsonError("Vues indisponibles.", error);
  }
}

/** POST /api/document-views — enregistre une vue ({ name, query, ... }). */
export async function POST(req: NextRequest) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: string; query?: string; description?: string; isPinned?: boolean };
    if (!body.name?.trim()) return NextResponse.json({ error: "name requis." }, { status: 400 });
    const view = await createView(u, { name: body.name, query: body.query ?? "", description: body.description ?? null, isPinned: body.isPinned ?? false });
    return NextResponse.json({ view }, { status: 201 });
  } catch (error) {
    return jsonError("Enregistrement de la vue impossible.", error);
  }
}
