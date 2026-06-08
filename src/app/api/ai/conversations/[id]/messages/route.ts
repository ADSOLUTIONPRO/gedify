import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { resolveAssistantUser } from "@/lib/assistant/conversation-auth";
import { appendMessages, getConversation, type AiConversationMessage } from "@/lib/assistant/conversation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/ai/conversations/:id/messages?offset=&limit= — messages paginés. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await resolveAssistantUser(req);
  if (auth.deny) return auth.deny;
  try {
    const { id } = await params;
    const conversation = await getConversation(id, auth.userId);
    if (!conversation) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(500, Math.max(1, Number(sp.get("limit") ?? "200") || 200));
    const offset = Math.max(0, Number(sp.get("offset") ?? "0") || 0);
    const total = conversation.messages.length;
    const messages = conversation.messages.slice(offset, offset + limit);
    return NextResponse.json({ messages, total, offset, limit });
  } catch (error) {
    return jsonError("Messages indisponibles.", error);
  }
}

type IncomingMessage = Pick<AiConversationMessage, "id" | "role" | "content"> &
  Partial<Pick<AiConversationMessage, "metadata" | "documentRefs" | "error" | "createdAt">>;

/**
 * POST /api/ai/conversations/:id/messages
 * Ajoute un (ou plusieurs) message(s). Ids fournis par le client (stables,
 * idempotents) → anti-doublon multi-onglets / retries côté store.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await resolveAssistantUser(req);
  if (auth.deny) return auth.deny;
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { messages?: IncomingMessage[]; message?: IncomingMessage };
    const incoming = body.messages ?? (body.message ? [body.message] : []);
    const valid = incoming.filter(
      (m) => m && typeof m.id === "string" && typeof m.content === "string" && (m.role === "user" || m.role === "assistant" || m.role === "system"),
    );
    if (valid.length === 0) return NextResponse.json({ error: "Aucun message valide." }, { status: 400 });

    const conversation = await appendMessages(id, auth.userId, valid);
    if (!conversation) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch (error) {
    return jsonError("Enregistrement du message impossible.", error);
  }
}
