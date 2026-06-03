import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getProjectFolderStats } from "@/lib/projects/project-store";

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: ProjectRouteContext) {
  try {
    const { id } = await params;
    const stats = await getProjectFolderStats(id);

    if (!stats) {
      return jsonError("Dossier/projet introuvable", `Aucun dossier pour ${id}`, 404);
    }

    return NextResponse.json(stats);
  } catch (error) {
    return jsonError("Impossible de récupérer les statistiques du dossier", error);
  }
}
