import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { ensureProjectPaperlessTag } from "@/lib/projects/project-paperless-sync";
import { deleteProject, getProjectFolder, updateProject } from "@/lib/projects/project-store";
import type { ProjectFolderPatch } from "@/lib/projects/project-types";

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: ProjectRouteContext) {
  try {
    const { id } = await params;
    const project = await getProjectFolder(id);

    if (!project) {
      return jsonError("Dossier/projet introuvable", `Aucun dossier pour ${id}`, 404);
    }

    return NextResponse.json(project);
  } catch (error) {
    return jsonError("Impossible de récupérer le dossier/projet", error);
  }
}

export async function PATCH(request: NextRequest, { params }: ProjectRouteContext) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as ProjectFolderPatch;
    let project = await updateProject(id, payload);

    if (!project) {
      return jsonError("Dossier/projet introuvable", `Aucun dossier pour ${id}`, 404);
    }

    if (project.syncWithPaperlessTag) {
      project = (await ensureProjectPaperlessTag(project)) ?? project;
    }

    return NextResponse.json(project);
  } catch (error) {
    return jsonError("Impossible de modifier le dossier/projet", error, 400);
  }
}

export async function PUT(request: NextRequest, context: ProjectRouteContext) {
  return PATCH(request, context);
}

export async function DELETE(request: NextRequest, { params }: ProjectRouteContext) {
  try {
    const { id } = await params;
    const mode = request.nextUrl.searchParams.get("mode") === "cascade" ? "cascade" : "reparent";
    const deleted = await deleteProject(id, mode);

    if (!deleted) {
      return jsonError("Dossier/projet introuvable", `Aucun dossier pour ${id}`, 404);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Impossible de supprimer le dossier/projet", error);
  }
}
