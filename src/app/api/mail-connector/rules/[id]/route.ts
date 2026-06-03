import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { deleteRule, getRule, updateRule } from "@/lib/mail-connector/rule-store";
import type { MailRuleInput } from "@/lib/mail-connector/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const rule = await getRule(id);
    if (!rule) {
      return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });
    }
    return NextResponse.json({ rule });
  } catch (error) {
    return jsonError("Impossible de récupérer la règle", error);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as MailRuleInput;
    const rule = await updateRule(id, body);
    if (!rule) {
      return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });
    }
    return NextResponse.json({ rule });
  } catch (error) {
    return jsonError("Impossible de modifier la règle", error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ok = await deleteRule(id);
    if (!ok) {
      return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer la règle", error);
  }
}
