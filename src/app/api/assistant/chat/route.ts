import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { handleAssistantChat } from "@/lib/assistant/assistant-router";
import { sanitizeHistory, sanitizeContext } from "@/lib/assistant/assistant-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const b = body as { message?: unknown; history?: unknown; context?: unknown };
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message vide." }, { status: 400 });

  try {
    const result = await handleAssistantChat({
      message,
      history: sanitizeHistory(b.history),
      context: sanitizeContext(b.context),
    });
    return NextResponse.json(result);
  } catch (error) {
    // Toujours répondre en JSON (sinon le client affiche « Erreur réseau » sans
    // détail). On surface le vrai message pour faciliter le diagnostic IA.
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[assistant/chat] échec :", detail);
    return NextResponse.json(
      {
        reply:
          "L'assistant n'a pas pu répondre. " +
          "Vérifiez la configuration IA (clé OpenAI / AI_CLOUD_API_KEY) et réessayez.\n\nDétail : " +
          detail.slice(0, 300),
        proposedActions: [],
        documentRefs: [],
        error: "assistant_error",
      },
      { status: 200 },
    );
  }
}
