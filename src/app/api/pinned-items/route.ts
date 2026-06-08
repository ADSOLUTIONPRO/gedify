import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { addPin, listPins, type PinnedEntityType } from "@/lib/dashboard/pinned-store";
import { listProjectFolders } from "@/lib/projects/project-store";
import type { ProjectFolder } from "@/lib/projects/project-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userId(req: NextRequest): Promise<string | { deny: NextResponse }> {
  const deny = await requireAuth(req);
  if (deny) return { deny };
  const user = await getCurrentUser();
  return user ? String(user.id) : "local";
}

function pathOf(folder: ProjectFolder, byId: Map<string, ProjectFolder>): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur: ProjectFolder | undefined = folder;
  while (cur && !seen.has(cur.id)) { parts.unshift(cur.name); seen.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
  return parts.join(" / ");
}

/** GET /api/pinned-items — épingles de l'utilisateur, résolues (nom/chemin/docs). */
export async function GET(req: NextRequest) {
  const uid = await userId(req);
  if (typeof uid !== "string") return uid.deny;
  try {
    const [pins, folders] = await Promise.all([listPins(uid), listProjectFolders()]);
    const byId = new Map(folders.map((f) => [f.id, f]));
    const items = pins.map((pin) => {
      const folder = byId.get(pin.entityId);
      return {
        id: pin.id,
        entityType: pin.entityType,
        entityId: pin.entityId,
        order: pin.order,
        exists: Boolean(folder),
        name: folder?.name ?? "(dossier supprimé)",
        path: folder ? pathOf(folder, byId) : null,
        documentCount: folder?.linkedDocumentIds.length ?? 0,
        archived: folder?.status === "Archivé",
        color: folder?.color ?? null,
        lastActivityAt: folder?.updatedAt ?? null,
      };
    });
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Épingles indisponibles.", error);
  }
}

/** POST /api/pinned-items — épingle un dossier/projet ({ entityType, entityId }). */
export async function POST(req: NextRequest) {
  const uid = await userId(req);
  if (typeof uid !== "string") return uid.deny;
  try {
    const body = (await req.json().catch(() => ({}))) as { entityType?: PinnedEntityType; entityId?: string };
    const entityType: PinnedEntityType = body.entityType === "project" ? "project" : "folder";
    if (!body.entityId) return NextResponse.json({ error: "entityId requis." }, { status: 400 });
    const pin = await addPin(uid, entityType, String(body.entityId));
    return NextResponse.json({ pin });
  } catch (error) {
    return jsonError("Épinglage impossible.", error);
  }
}
