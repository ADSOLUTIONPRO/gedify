import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { detectInstallation, getUpdateState } from "@/lib/admin/update-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/updates — installation détectée + dernier état de version. */
export async function GET(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const [installation, state] = await Promise.all([Promise.resolve(detectInstallation()), getUpdateState()]);
    return NextResponse.json({ installation, state });
  } catch (error) {
    return jsonError("État des mises à jour indisponible.", error);
  }
}
