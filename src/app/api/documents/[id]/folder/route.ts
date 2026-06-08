import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { listProjectFolders } from "@/lib/projects/project-store";
import type { ProjectFolder } from "@/lib/projects/project-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function pathOf(folder: ProjectFolder, byId: Map<string, ProjectFolder>): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur: ProjectFolder | undefined = folder;
  while (cur && !seen.has(cur.id)) { parts.unshift(cur.name); seen.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
  return parts.join(" / ");
}

/**
 * GET /api/documents/:id/folder — dossier/projet auquel le document est
 * actuellement rattaché (le premier trouvé), pour ré-afficher le sélecteur de
 * dossier dans la Fiche Doc à la réouverture.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const { id } = await params;
    const documentId = Number(id);
    const folders = await listProjectFolders();
    const byId = new Map(folders.map((f) => [f.id, f]));
    const folder = folders.find((f) => f.linkedDocumentIds.includes(documentId));
    if (!folder) return NextResponse.json({ folder: null });
    return NextResponse.json({ folder: { id: folder.id, type: "folder", name: folder.name, path: pathOf(folder, byId) } });
  } catch (error) {
    return jsonError("Dossier du document indisponible.", error);
  }
}
