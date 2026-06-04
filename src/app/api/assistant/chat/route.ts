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

  const result = await handleAssistantChat({
    message,
    history: sanitizeHistory(b.history),
    context: sanitizeContext(b.context),
  });
  return NextResponse.json(result);
}
