import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { syncMailAccount } from "@/lib/mail-connector/sync-mail-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await syncMailAccount(id);
    return NextResponse.json({ result });
  } catch (error) {
    return jsonError("Impossible de synchroniser le compte", error);
  }
}
