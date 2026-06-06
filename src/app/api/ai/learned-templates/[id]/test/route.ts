import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getLearnedTemplate } from "@/lib/ai/learned-templates-store";
import { getActiveAIProvider } from "@/lib/ai/ai-provider";
import { getDocument } from "@/lib/paperless";
import { withTimeout } from "@/lib/jobs/with-timeout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/ai/learned-templates/:id/test  body: { documentId? , text? }
 *
 * SIMULATION : exécute l'analyse IA en injectant le prompt PERSONNALISÉ du modèle,
 * sur un document existant ou un texte collé. NE MODIFIE AUCUN document
 * (« Appliquer » est une action distincte côté document). Aucun secret renvoyé.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const tpl = await getLearnedTemplate(id);
    if (!tpl) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as { documentId?: number; text?: string };

    let content = "";
    let title = tpl.label;
    let documentId = 0;
    if (typeof body.documentId === "number" && Number.isFinite(body.documentId)) {
      const doc = await getDocument(body.documentId).catch(() => null);
      content = doc?.content ?? "";
      title = doc?.title ?? title;
      documentId = body.documentId;
    } else if (typeof body.text === "string") {
      content = body.text;
    }
    if (!content.trim()) {
      return NextResponse.json({ error: "Fournissez un documentId avec OCR, ou un texte à analyser." }, { status: 400 });
    }

    const extra = [tpl.promptSystem, tpl.promptInstructions]
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .join("\n\n")
      .trim();

    const provider = getActiveAIProvider();
    const result = await withTimeout(
      provider.analyzeDocument({
        documentId,
        title,
        content: content.slice(0, 20000),
        extraInstructions: extra || undefined,
      }),
      120_000,
      `test modèle ${id}`,
    );

    return NextResponse.json({ ok: true, result, promptUsed: extra.length > 0 });
  } catch (error) {
    return jsonError("Test du modèle impossible", error);
  }
}
