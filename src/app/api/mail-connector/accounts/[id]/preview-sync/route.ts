import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { previewMailSync } from "@/lib/mail-connector/mail-sync-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Math.min(100, Math.max(1, Number.parseInt(limitRaw, 10))) : 30;
    const preview = await previewMailSync(id, limit);
    return NextResponse.json({ preview });
  } catch (error) {
    return jsonError("Prévisualisation impossible", error);
  }
}
