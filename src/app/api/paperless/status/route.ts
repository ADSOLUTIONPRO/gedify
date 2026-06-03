import { NextResponse } from "next/server";
import { getPaperlessStatus } from "@/lib/paperless";

export async function GET() {
  const status = await getPaperlessStatus();
  return NextResponse.json(status, { status: status.connected ? 200 : 503 });
}
