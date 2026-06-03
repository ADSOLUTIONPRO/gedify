import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/mail-connector/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ providers: PROVIDERS });
}
