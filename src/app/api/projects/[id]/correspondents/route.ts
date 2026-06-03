import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getCorrespondents } from "@/lib/paperless";
import { getProjectFolder } from "@/lib/projects/project-store";

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

    const ids = new Set(project.linkedCorrespondentIds);
    const correspondents = await getCorrespondents({ page_size: 1000 });
    const results = correspondents.results.filter((item) => ids.has(item.id));

    return NextResponse.json({ count: results.length, results });
  } catch (error) {
    return jsonError("Impossible de récupérer les correspondants du dossier", error);
  }
}
