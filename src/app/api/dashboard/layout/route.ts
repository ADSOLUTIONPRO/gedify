import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLayout, saveLayout } from "@/lib/dashboard/layout-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function uid(req: NextRequest): Promise<string | { deny: NextResponse }> {
  const deny = await requireAuth(req);
  if (deny) return { deny };
  const user = await getCurrentUser();
  return user ? String(user.id) : "local";
}

/** GET /api/dashboard/layout — disposition du tableau de bord de l'utilisateur. */
export async function GET(req: NextRequest) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    return NextResponse.json({ layout: await getLayout(u) });
  } catch (error) {
    return jsonError("Disposition indisponible.", error);
  }
}

/** PUT /api/dashboard/layout — enregistre la disposition (visibilité + ordre). */
export async function PUT(req: NextRequest) {
  const u = await uid(req);
  if (typeof u !== "string") return u.deny;
  try {
    const body = (await req.json().catch(() => ({}))) as { visibility?: Record<string, boolean>; order?: string[] };
    const layout = await saveLayout(u, body.visibility ?? {}, Array.isArray(body.order) ? body.order : []);
    return NextResponse.json({ layout });
  } catch (error) {
    return jsonError("Enregistrement de la disposition impossible.", error);
  }
}
