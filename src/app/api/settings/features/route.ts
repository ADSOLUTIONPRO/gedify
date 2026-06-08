import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getGedifyFeatureFlags, saveGedifyFeatureFlags } from "@/lib/settings/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* GET  /api/settings/features → drapeaux courants.
   PUT  /api/settings/features → met à jour { financeSpaceEnabled?, autoBudgetClassificationEnabled? }.
   Auth gérée par le middleware (cf. autres routes /api/settings, /api/assistant). */

export async function GET() {
  try {
    return NextResponse.json({ ok: true, flags: await getGedifyFeatureFlags() });
  } catch (error) {
    return jsonError("Lecture des modules impossible.", error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Parameters<typeof saveGedifyFeatureFlags>[0] = {};
    if (typeof body.financeSpaceEnabled === "boolean") patch.financeSpaceEnabled = body.financeSpaceEnabled;
    if (typeof body.autoBudgetClassificationEnabled === "boolean")
      patch.autoBudgetClassificationEnabled = body.autoBudgetClassificationEnabled;
    if (typeof body.autoAiAnalysisEnabled === "boolean") patch.autoAiAnalysisEnabled = body.autoAiAnalysisEnabled;
    if (typeof body.autoContactSyncEnabled === "boolean") patch.autoContactSyncEnabled = body.autoContactSyncEnabled;
    const flags = await saveGedifyFeatureFlags(patch);
    return NextResponse.json({ ok: true, flags });
  } catch (error) {
    return jsonError("Mise à jour des modules impossible.", error);
  }
}
