import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { postponeReminder } from "@/lib/actions/reminder-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
type Body = { remindAt: string };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Body;
    if (!body.remindAt) return NextResponse.json({ error: "remindAt requis." }, { status: 400 });
    const item = await postponeReminder(id, body.remindAt);
    if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Report du rappel impossible", error);
  }
}
