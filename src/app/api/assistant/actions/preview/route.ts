import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { sanitizeAction } from "@/lib/assistant/assistant-memory";
import { readStore, STORE, type EngineDocument } from "@/lib/engine/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aperçu d'une action avant confirmation : résout les titres des documents
 * concernés (sans rien modifier) pour alimenter la carte d'action / « Voir les documents ».
 */
export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const action = sanitizeAction((body as { action?: unknown }).action);
  if (!action) return NextResponse.json({ error: "Action invalide." }, { status: 400 });

  const docs = action.documentIds.length
    ? await readStore<EngineDocument[]>(STORE.documents, [])
    : [];
  const byId = new Map(docs.map((d) => [d.id, d]));
  const documents = action.documentIds.map((id) => ({
    id,
    title: byId.get(id)?.title ?? `Document ${id}`,
  }));

  return NextResponse.json({
    ok: true,
    type: action.type,
    label: action.label,
    description: action.description,
    documentCount: documents.length,
    documents,
    sensitive: action.sensitive,
    requiresConfirmation: action.requiresConfirmation,
  });
}
