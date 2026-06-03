import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, paperlessProxyError } from "@/lib/api-utils";
import {
  createPaperlessObject,
  getCorrespondents,
} from "@/lib/paperless";
import type { PaperlessCorrespondent } from "@/lib/paperless-types";

export async function GET(request: NextRequest) {
  try {
    const data = await getCorrespondents(request.nextUrl.searchParams);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de récupérer les correspondants Gedify", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const data = await createPaperlessObject<PaperlessCorrespondent>(
      "/api/correspondents/",
      payload
    );

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return paperlessProxyError("Impossible de créer le correspondant Gedify", error);
  }
}
