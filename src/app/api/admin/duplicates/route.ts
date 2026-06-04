import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/current-user";
import { jsonError } from "@/lib/api-utils";
import { findDuplicateGroups } from "@/lib/documents/duplicate-detection";

/* Liste des groupes de doublons (exacts + probables). Lecture seule. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requirePermission(request, "admin.access");
  if (deny) return deny;
  try {
    const groups = await findDuplicateGroups();
    return NextResponse.json({ count: groups.length, groups });
  } catch (error) {
    return jsonError("Impossible de détecter les doublons", error);
  }
}
