import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { duplicateLearnedTemplate } from "@/lib/ai/learned-templates-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/ai/learned-templates/:id/duplicate → copie (désactivée) du modèle. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const item = await duplicateLearnedTemplate(id);
    if (!item) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Duplication du modèle impossible", error);
  }
}
