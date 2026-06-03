import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { deleteGedView, getGedView, updateGedView } from "@/lib/ged/ged-store";
import type { GedSavedViewInput } from "@/lib/ged/ged-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ViewContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: ViewContext) {
  try {
    const { id } = await params;
    const view = await getGedView(id);

    if (!view) {
      return jsonError("Vue GED introuvable", `Aucune vue pour ${id}`, 404);
    }

    return NextResponse.json(view);
  } catch (error) {
    return jsonError("Impossible de récupérer la vue GED AzServer", error);
  }
}

export async function PATCH(request: NextRequest, { params }: ViewContext) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as Partial<GedSavedViewInput>;
    const view = await updateGedView(id, payload);

    if (!view) {
      return jsonError("Vue GED introuvable", `Aucune vue pour ${id}`, 404);
    }

    return NextResponse.json(view);
  } catch (error) {
    return jsonError("Impossible de modifier la vue GED AzServer", error, 400);
  }
}

export async function PUT(request: NextRequest, context: ViewContext) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, { params }: ViewContext) {
  try {
    const { id } = await params;
    const deleted = await deleteGedView(id);

    if (!deleted) {
      return jsonError("Vue GED introuvable", `Aucune vue pour ${id}`, 404);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Impossible de supprimer la vue GED AzServer", error);
  }
}
