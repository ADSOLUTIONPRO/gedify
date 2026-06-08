import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { resolveAssistantUser } from "@/lib/assistant/conversation-auth";
import { deleteConversation, getConversation, updateConversation, type AiConversationContext } from "@/lib/assistant/conversation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/ai/conversations/:id — conversation complète (messages inclus). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await resolveAssistantUser(req);
  if (auth.deny) return auth.deny;
  try {
    const { id } = await params;
    const conversation = await getConversation(id, auth.userId);
    if (!conversation) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch (error) {
    return jsonError("Conversation indisponible.", error);
  }
}

/** PATCH /api/ai/conversations/:id — renommer / archiver / contexte. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await resolveAssistantUser(req);
  if (auth.deny) return auth.deny;
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      status?: "active" | "archived";
      context?: AiConversationContext | null;
      model?: string | null;
      provider?: string | null;
    };
    const conversation = await updateConversation(id, auth.userId, body);
    if (!conversation) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch (error) {
    return jsonError("Mise à jour impossible.", error);
  }
}

/** DELETE /api/ai/conversations/:id — suppression définitive. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await resolveAssistantUser(req);
  if (auth.deny) return auth.deny;
  try {
    const { id } = await params;
    const ok = await deleteConversation(id, auth.userId);
    if (!ok) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression impossible.", error);
  }
}
