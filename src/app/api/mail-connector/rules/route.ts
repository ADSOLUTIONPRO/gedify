import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createRule, listRules } from "@/lib/mail-connector/rule-store";
import type { MailRuleInput } from "@/lib/mail-connector/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rules = await listRules();
    return NextResponse.json({ rules });
  } catch (error) {
    return jsonError("Impossible de lister les règles", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MailRuleInput;
    const rule = await createRule(body);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer la règle", error);
  }
}
