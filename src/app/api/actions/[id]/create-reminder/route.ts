import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getAction } from "@/lib/actions/action-store";
import { createReminder } from "@/lib/actions/reminder-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
type Body = { remindAt?: string; title?: string };

/** Crée un rappel lié à une action ([id] = actionId). */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const action = await getAction(id);
    if (!action) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Body;
    const remindAt = body.remindAt ?? action.dueDate ?? new Date(Date.now() + 86_400_000).toISOString();
    const reminder = await createReminder({
      title: body.title ?? `Rappel : ${action.title}`,
      remindAt,
      actionId: action.id,
      documentId: action.documentIds[0] ?? null,
      financialItemId: action.budgetItemId,
      projectId: action.projectId,
      correspondentId: action.correspondentId,
      priority: action.priority,
    });
    return NextResponse.json({ reminder }, { status: 201 });
  } catch (error) {
    return jsonError("Création du rappel impossible", error);
  }
}
