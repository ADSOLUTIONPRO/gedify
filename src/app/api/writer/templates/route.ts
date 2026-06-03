import { NextResponse } from "next/server";
import { TEMPLATES } from "@/lib/writer/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ templates: TEMPLATES });
}
