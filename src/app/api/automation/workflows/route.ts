import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createGedWorkflow, listGedWorkflows } from "@/lib/ged/ged-store";
import type { GedWorkflowInput } from "@/lib/ged/ged-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workflows = await listGedWorkflows();
    return NextResponse.json({ count: workflows.length, results: workflows });
  } catch (error) {
    return jsonError("Impossible de lister les workflows GED AzServer", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as GedWorkflowInput;
    const workflow = await createGedWorkflow(payload);
    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer le workflow GED AzServer", error, 400);
  }
}
