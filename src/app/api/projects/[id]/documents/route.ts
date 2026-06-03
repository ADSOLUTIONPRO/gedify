import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getDocument } from "@/lib/paperless";
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

    const documents = await Promise.allSettled(
      project.linkedDocumentIds.map((documentId) => getDocument(documentId))
    );

    return NextResponse.json({
      count: documents.filter((result) => result.status === "fulfilled").length,
      results: documents
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value),
    });
  } catch (error) {
    return jsonError("Impossible de récupérer les documents liés au dossier", error);
  }
}
