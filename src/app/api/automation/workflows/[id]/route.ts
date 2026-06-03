import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deleteGedWorkflow,
  getGedWorkflow,
  updateGedWorkflow,
} from "@/lib/ged/ged-store";
import type { GedWorkflowInput } from "@/lib/ged/ged-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkflowContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: WorkflowContext) {
  try {
    const { id } = await params;
    const workflow = await getGedWorkflow(id);

    if (!workflow) {
      return jsonError("Workflow GED introuvable", `Aucun workflow pour ${id}`, 404);
    }

    return NextResponse.json(workflow);
  } catch (error) {
    return jsonError("Impossible de récupérer le workflow GED AzServer", error);
  }
}

export async function PATCH(request: NextRequest, { params }: WorkflowContext) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as Partial<GedWorkflowInput>;
    const workflow = await updateGedWorkflow(id, payload);

    if (!workflow) {
      return jsonError("Workflow GED introuvable", `Aucun workflow pour ${id}`, 404);
    }

    return NextResponse.json(workflow);
  } catch (error) {
    return jsonError("Impossible de modifier le workflow GED AzServer", error, 400);
  }
}

export async function PUT(request: NextRequest, context: WorkflowContext) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, { params }: WorkflowContext) {
  try {
    const { id } = await params;
    const deleted = await deleteGedWorkflow(id);

    if (!deleted) {
      return jsonError("Workflow GED introuvable", `Aucun workflow pour ${id}`, 404);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Impossible de supprimer le workflow GED AzServer", error);
  }
}
