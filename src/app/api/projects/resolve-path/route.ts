import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { resolveFolderPath } from "@/lib/projects/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Find-or-create d'une chaîne de dossiers « A / B / C » → dossier feuille.
 * Permet de créer un sous-dossier (ou toute l'arborescence) par chemin.
 */
export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const body = (await request.json().catch(() => ({}))) as { path?: string };
    if (!body.path?.trim()) {
      return NextResponse.json({ error: "Paramètre `path` requis." }, { status: 400 });
    }
    const folder = await resolveFolderPath(body.path);
    if (!folder) return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
    return NextResponse.json({ folder });
  } catch (error) {
    return jsonError("Résolution du chemin de dossier impossible", error);
  }
}
