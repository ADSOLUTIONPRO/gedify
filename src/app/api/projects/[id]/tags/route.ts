import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getTags } from "@/lib/paperless";
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

    const ids = new Set(project.linkedTagIds);
    const tags = await getTags({ page_size: 1000 });
    const results = tags.results.filter((item) => ids.has(item.id));

    return NextResponse.json({ count: results.length, results });
  } catch (error) {
    return jsonError("Impossible de récupérer les tags du dossier", error);
  }
}
