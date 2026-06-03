import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  createDetectedInfo,
  listDetectedInfos,
  type ListDetectedInfoOptions,
} from "@/lib/ai/detected-info-store";
import { synthesizeDetectedInfos } from "@/lib/ai/detected-info-utils";
import { bulkUpsertFromSynthesis } from "@/lib/ai/detected-info-store";
import { getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";
import type {
  DetectedInfoInput,
  DetectedInfoKind,
  DetectedInfoSource,
  DetectedInfoStatus,
} from "@/lib/ai/detected-info-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const options: ListDetectedInfoOptions = {};
    const documentId = url.searchParams.get("documentId");
    if (documentId) options.documentId = Number.parseInt(documentId, 10);
    const analysisId = url.searchParams.get("analysisId");
    if (analysisId) options.analysisId = analysisId;
    const kind = url.searchParams.get("kind");
    if (kind) options.kind = kind as DetectedInfoKind;
    const status = url.searchParams.get("status");
    if (status) options.status = status as DetectedInfoStatus;
    const source = url.searchParams.get("source");
    if (source) options.source = source as DetectedInfoSource;

    // If asked for a documentId and store is empty, synthesize from the latest analysis.
    if (documentId && !analysisId) {
      const existing = await listDetectedInfos({ documentId: options.documentId });
      if (existing.length === 0) {
        const analysis = await getLatestAnalysisForDocument(options.documentId!);
        if (analysis) {
          await bulkUpsertFromSynthesis(synthesizeDetectedInfos(analysis));
        }
      }
    }

    const items = await listDetectedInfos(options);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de lister les informations détectées", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DetectedInfoInput;
    const item = await createDetectedInfo({
      ...body,
      source: body.source ?? "user",
      status: body.status ?? "validated",
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer l'information", error);
  }
}
