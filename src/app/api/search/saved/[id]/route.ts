import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { deleteSavedSearch } from "@/lib/search/saved-search-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await context.params;
    const ok = await deleteSavedSearch(id);
    return NextResponse.json({ ok });
  } catch (error) {
    return jsonError("Impossible de supprimer la recherche", error);
  }
}
