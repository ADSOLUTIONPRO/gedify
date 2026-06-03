import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { ensureProjectPaperlessTag } from "@/lib/projects/project-paperless-sync";
import { createProject, getProjectStoreInfo, listProjectFolders } from "@/lib/projects/project-store";
import type { ProjectFolderInput } from "@/lib/projects/project-types";

export async function GET() {
  try {
    const projects = await listProjectFolders();
    return NextResponse.json({
      count: projects.length,
      results: projects,
      store: getProjectStoreInfo(),
    });
  } catch (error) {
    return jsonError("Impossible de récupérer les dossiers/projets", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ProjectFolderInput;
    let project = await createProject(payload);

    if (project.syncWithPaperlessTag) {
      project = (await ensureProjectPaperlessTag(project)) ?? project;
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer le dossier/projet", error, 400);
  }
}
