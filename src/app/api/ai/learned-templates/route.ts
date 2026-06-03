import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listLearnedTemplates } from "@/lib/ai/learned-templates-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listLearnedTemplates();
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de lister les modèles appris", error);
  }
}
