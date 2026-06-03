import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getMailConnectorStatus } from "@/lib/mail-connector/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getMailConnectorStatus();
    return NextResponse.json({ status });
  } catch (error) {
    return jsonError("Impossible de récupérer le statut du connecteur", error);
  }
}
