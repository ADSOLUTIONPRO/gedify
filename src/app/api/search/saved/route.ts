import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { listSavedSearches, createSavedSearch } from "@/lib/search/saved-search-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    return NextResponse.json({ searches: await listSavedSearches() });
  } catch (error) {
    return jsonError("Impossible de lister les recherches sauvegardées", error);
  }
}

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const body = (await request.json()) as { name?: string; params?: Record<string, string> };
    const search = await createSavedSearch({ name: body.name ?? "", params: body.params ?? {} });
    return NextResponse.json(search);
  } catch (error) {
    return jsonError("Impossible d'enregistrer la recherche", error);
  }
}
