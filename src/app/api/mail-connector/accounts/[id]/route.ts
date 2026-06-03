import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deleteAccount,
  getAccount,
  updateAccount,
} from "@/lib/mail-connector/account-store";
import type { MailAccountInput } from "@/lib/mail-connector/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const account = await getAccount(id);
    if (!account) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }
    return NextResponse.json({ account });
  } catch (error) {
    return jsonError("Impossible de récupérer le compte mail", error);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as MailAccountInput;
    const account = await updateAccount(id, body);
    if (!account) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }
    return NextResponse.json({ account });
  } catch (error) {
    return jsonError("Impossible de modifier le compte mail", error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ok = await deleteAccount(id);
    if (!ok) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer le compte mail", error);
  }
}
