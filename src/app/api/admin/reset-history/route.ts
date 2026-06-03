import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { resetGedInternalHistory } from "@/lib/admin/reset-ged-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_CONFIRM = "RESET_GED_HISTORY";
const EXPECTED_SCOPE = "internal-history-only";

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (body.confirm !== EXPECTED_CONFIRM) {
    return NextResponse.json(
      { error: `Confirmation manquante ou incorrecte. Envoyez { "confirm": "${EXPECTED_CONFIRM}" }.` },
      { status: 400 },
    );
  }

  if (body.scope !== EXPECTED_SCOPE) {
    return NextResponse.json(
      { error: `Scope incorrect. Envoyez { "scope": "${EXPECTED_SCOPE}" }.` },
      { status: 400 },
    );
  }

  try {
    const result = await resetGedInternalHistory({
      resetAiHistory: true,
      resetDetectedInfos: true,
      resetCorrectionMemory: true,
      resetBudgetDrafts: true,
      resetActionDrafts: true,
      preservePaperlessDocuments: true,
      preservePaperlessTaxonomies: true,
      preserveSettings: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError("Erreur lors du reset de l'historique GED", error);
  }
}
