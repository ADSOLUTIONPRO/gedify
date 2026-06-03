import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { completeAction } from "@/lib/actions/action-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { note?: string };
    const item = await completeAction(id, body.note);
    if (!item) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Impossible de terminer l'action", error);
  }
}
