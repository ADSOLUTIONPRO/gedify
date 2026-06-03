import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, paperlessProxyError } from "@/lib/api-utils";
import {
  createPaperlessObject,
  getDocumentTypes,
} from "@/lib/paperless";
import type { PaperlessDocumentType } from "@/lib/paperless-types";

export async function GET(request: NextRequest) {
  try {
    const data = await getDocumentTypes(request.nextUrl.searchParams);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de récupérer les types de documents Gedify", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const data = await createPaperlessObject<PaperlessDocumentType>(
      "/api/document_types/",
      payload
    );

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return paperlessProxyError("Impossible de créer le type de document Gedify", error);
  }
}
