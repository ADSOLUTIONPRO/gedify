import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deletePaperlessObject,
  paperlessFetch,
  updatePaperlessObject,
} from "@/lib/paperless";
import type { PaperlessDocumentType } from "@/lib/paperless-types";

type ObjectRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: ObjectRouteContext) {
  try {
    const { id } = await params;
    const data = await paperlessFetch<PaperlessDocumentType>(`/api/document_types/${id}/`);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de récupérer le type de document Gedify", error);
  }
}

export async function PATCH(request: NextRequest, { params }: ObjectRouteContext) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as Record<string, unknown>;
    const data = await updatePaperlessObject<PaperlessDocumentType>(
      "/api/document_types/",
      id,
      payload
    );
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de modifier le type de document Gedify", error);
  }
}

export async function DELETE(_request: NextRequest, { params }: ObjectRouteContext) {
  try {
    const { id } = await params;
    await deletePaperlessObject("/api/document_types/", id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer le type de document Gedify", error);
  }
}
