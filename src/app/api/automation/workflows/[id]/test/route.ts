import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getGedWorkflow } from "@/lib/ged/ged-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkflowContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, { params }: WorkflowContext) {
  try {
    const { id } = await params;
    const workflow = await getGedWorkflow(id);

    if (!workflow) {
      return jsonError("Workflow GED introuvable", `Aucun workflow pour ${id}`, 404);
    }

    return NextResponse.json({
      ok: true,
      dryRun: true,
      message:
        "Test simulé : le moteur d'exécution est prêt, aucune modification Gedify n'a été appliquée.",
      preview: {
        trigger: workflow.trigger,
        conditions: workflow.conditions,
        actions: workflow.actions,
      },
    });
  } catch (error) {
    return jsonError("Impossible de tester le workflow GED AzServer", error);
  }
}
