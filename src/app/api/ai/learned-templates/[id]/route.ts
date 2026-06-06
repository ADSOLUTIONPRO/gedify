import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { readSession } from "@/lib/auth/session";
import {
  removeLearnedTemplate,
  updateLearnedTemplate,
  type LearnedTemplatePatch,
} from "@/lib/ai/learned-templates-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Détecte une clé secrète probable (OpenAI sk-…) — jamais stockée dans un prompt. */
const SECRET_RE = /\bsk-[A-Za-z0-9_-]{16,}/;
const MAX_PROMPT = 8000;
const MAX_DESC = 2000;

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Garde-fou sécurité : refuser un prompt contenant un secret.
    for (const key of ["promptSystem", "promptInstructions"] as const) {
      if (typeof body[key] === "string" && SECRET_RE.test(body[key] as string)) {
        return NextResponse.json(
          { error: "Le prompt contient ce qui ressemble à une clé secrète (sk-…). Retirez-la avant d'enregistrer." },
          { status: 400 },
        );
      }
    }

    const patch: LearnedTemplatePatch = {};
    if (typeof body.active === "boolean") patch.active = body.active;
    if (typeof body.label === "string" && (body.label as string).trim()) patch.label = (body.label as string).trim();
    if (typeof body.description === "string") patch.description = (body.description as string).slice(0, MAX_DESC);
    if (typeof body.promptSystem === "string") patch.promptSystem = (body.promptSystem as string).slice(0, MAX_PROMPT);
    if (typeof body.promptInstructions === "string")
      patch.promptInstructions = (body.promptInstructions as string).slice(0, MAX_PROMPT);
    if (body.restorePrompt === true) patch.restorePrompt = true;

    const session = await readSession().catch(() => null);
    patch.updatedBy = session?.username ?? null;

    const item = await updateLearnedTemplate(id, patch);
    if (!item) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError("Modification du modèle impossible", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const ok = await removeLearnedTemplate(id);
    if (!ok) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression du modèle impossible", error);
  }
}
