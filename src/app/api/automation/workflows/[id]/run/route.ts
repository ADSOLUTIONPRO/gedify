import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getGedWorkflow, markGedWorkflowRun } from "@/lib/ged/ged-store";
import { runWorkflowOverAll } from "@/lib/automation/workflow-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

    // Application RÉELLE de la règle à tous les documents existants qui matchent.
    const { matched, applied, sample } = await runWorkflowOverAll(workflow, { dryRun: false });
    const updated = await markGedWorkflowRun(id);

    return NextResponse.json({
      ok: true,
      workflow: updated ?? workflow,
      matched,
      applied,
      sample,
      message: `Règle appliquée à ${applied} document(s) (sur ${matched} correspondant·s).`,
    });
  } catch (error) {
    return jsonError("Impossible d'exécuter le workflow GED", error);
  }
}
