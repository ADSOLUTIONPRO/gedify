import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getAnalysis, deleteAnalysis } from "@/lib/ai/ai-analysis-store";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const analysis = await getAnalysis(id);
    if (!analysis) {
      return NextResponse.json({ error: "Analyse introuvable" }, { status: 404 });
    }
    return NextResponse.json(analysis);
  } catch (error) {
    return jsonError("Impossible de récupérer l'analyse IA", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const deleted = await deleteAnalysis(id);
    if (!deleted) {
      return NextResponse.json({ error: "Analyse introuvable" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    return jsonError("Impossible de supprimer l'analyse IA", error);
  }
}
