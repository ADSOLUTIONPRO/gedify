import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createGedView, listGedViews } from "@/lib/ged/ged-store";
import type { GedSavedViewInput } from "@/lib/ged/ged-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const views = await listGedViews();
    return NextResponse.json({ count: views.length, results: views });
  } catch (error) {
    return jsonError("Impossible de lister les vues GED AzServer", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as GedSavedViewInput;
    const view = await createGedView(payload);
    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer la vue GED AzServer", error, 400);
  }
}
