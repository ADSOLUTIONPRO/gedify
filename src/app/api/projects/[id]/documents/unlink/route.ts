import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { removeProjectPaperlessTag } from "@/lib/projects/project-paperless-sync";
import { unlinkProjectDocuments } from "@/lib/projects/project-store";
import { normalizeProjectIds } from "@/lib/projects/project-utils";

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

async function unlink(request: NextRequest, { params }: ProjectRouteContext) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as { documentIds?: unknown };
    const documentIds = normalizeProjectIds(payload.documentIds);
    const project = await unlinkProjectDocuments(id, documentIds);

    if (!project) {
      return jsonError("Dossier/projet introuvable", `Aucun dossier pour ${id}`, 404);
    }

    if (project.syncWithPaperlessTag && documentIds.length > 0) {
      await removeProjectPaperlessTag(project, documentIds);
    }

    return NextResponse.json(project);
  } catch (error) {
    return jsonError("Impossible de retirer les documents du dossier", error, 400);
  }
}

export async function POST(request: NextRequest, context: ProjectRouteContext) {
  return unlink(request, context);
}

export async function DELETE(request: NextRequest, context: ProjectRouteContext) {
  return unlink(request, context);
}
