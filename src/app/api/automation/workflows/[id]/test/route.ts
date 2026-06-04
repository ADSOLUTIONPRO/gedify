import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getGedWorkflow } from "@/lib/ged/ged-store";
import { runWorkflowOverAll } from "@/lib/automation/workflow-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

    // Simulation : aucune écriture, on compte les documents concernés + échantillon.
    const { matched, sample } = await runWorkflowOverAll(workflow, { dryRun: true });

    return NextResponse.json({
      ok: true,
      dryRun: true,
      matched,
      sample,
      preview: {
        trigger: workflow.trigger,
        conditions: workflow.conditions,
        actions: workflow.actions,
      },
      message:
        matched > 0
          ? `${matched} document(s) correspondent à cette règle.`
          : "Aucun document ne correspond à cette règle pour l'instant.",
    });
  } catch (error) {
    return jsonError("Impossible de simuler le workflow GED", error);
  }
}
