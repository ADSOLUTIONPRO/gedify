import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deletePaperlessObject,
  paperlessFetch,
  updatePaperlessObject,
} from "@/lib/paperless";
import type { PaperlessTag } from "@/lib/paperless-types";

type ObjectRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: ObjectRouteContext) {
  try {
    const { id } = await params;
    const data = await paperlessFetch<PaperlessTag>(`/api/tags/${id}/`);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de récupérer le tag Gedify", error);
  }
}

export async function PATCH(request: NextRequest, { params }: ObjectRouteContext) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as Record<string, unknown>;
    const data = await updatePaperlessObject<PaperlessTag>("/api/tags/", id, payload);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de modifier le tag Gedify", error);
  }
}

export async function DELETE(_request: NextRequest, { params }: ObjectRouteContext) {
  try {
    const { id } = await params;
    await deletePaperlessObject("/api/tags/", id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer le tag Gedify", error);
  }
}
