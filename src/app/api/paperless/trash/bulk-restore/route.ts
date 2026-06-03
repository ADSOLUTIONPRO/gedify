import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: { documentIds?: number[] };
  try {
    body = (await request.json()) as { documentIds?: number[] };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const documentIds = body.documentIds;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json(
      { error: "documentIds requis (tableau non vide)." },
      { status: 400 },
    );
  }

  try {
    const data = await paperlessFetch<unknown>("/api/trash/", {
      method: "POST",
      body: { action: "restore", documents: documentIds.map(Number) },
    });
    return NextResponse.json({ ok: true, restored: documentIds.length, data: data ?? null });
  } catch (error) {
    return jsonError("Impossible de restaurer les documents depuis la corbeille Gedify", error);
  }
}
