import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { markGedWorkflowRun } from "@/lib/ged/ged-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkflowContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, { params }: WorkflowContext) {
  try {
    const { id } = await params;
    const workflow = await markGedWorkflowRun(id);

    if (!workflow) {
      return jsonError("Workflow GED introuvable", `Aucun workflow pour ${id}`, 404);
    }

    return NextResponse.json({
      ok: true,
      workflow,
      message:
        "Exécution enregistrée côté GED AzServer. Les actions réelles Gedify restent à brancher workflow par workflow.",
    });
  } catch (error) {
    return jsonError("Impossible d'exécuter le workflow GED AzServer", error);
  }
}
