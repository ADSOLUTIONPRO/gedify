import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { appendGedLog, listGedLogs } from "@/lib/ged/ged-store";
import type { GedLogInput } from "@/lib/ged/ged-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 250);
    const documentIdParam = request.nextUrl.searchParams.get("documentId");
    const documentId = documentIdParam ? Number.parseInt(documentIdParam, 10) : undefined;
    const logs = await listGedLogs(
      Number.isFinite(limit) ? limit : 250,
      documentId !== undefined && Number.isFinite(documentId) ? { documentId } : undefined,
    );
    return NextResponse.json({ count: logs.length, results: logs });
  } catch (error) {
    return jsonError("Impossible de lister les journaux GED AzServer", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as GedLogInput;
    const log = await appendGedLog(payload);
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    return jsonError("Impossible d'ajouter une entrée de journal GED AzServer", error, 400);
  }
}
