import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deleteAction,
  getAction,
  updateAction,
} from "@/lib/actions/action-store";
import type { ActionItemInput } from "@/lib/actions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const item = await getAction(id);
    if (!item) {
      return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible de récupérer l'action", error);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as ActionItemInput;
    const item = await updateAction(id, body);
    if (!item) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible de modifier l'action", error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ok = await deleteAction(id);
    if (!ok) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer l'action", error);
  }
}
