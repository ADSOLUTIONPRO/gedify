import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { applyProjectPaperlessTag } from "@/lib/projects/project-paperless-sync";
import { linkProjectDocuments } from "@/lib/projects/project-store";
import { normalizeProjectIds } from "@/lib/projects/project-utils";

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: ProjectRouteContext) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as { documentIds?: unknown };
    const documentIds = normalizeProjectIds(payload.documentIds);
    let project = await linkProjectDocuments(id, documentIds);

    if (!project) {
      return jsonError("Dossier/projet introuvable", `Aucun dossier pour ${id}`, 404);
    }

    if (project.syncWithPaperlessTag && documentIds.length > 0) {
      project = (await applyProjectPaperlessTag(project, documentIds)) ?? project;
    }

    return NextResponse.json(project);
  } catch (error) {
    return jsonError("Impossible de lier les documents au dossier", error, 400);
  }
}
