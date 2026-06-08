import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { resolveAssistantUser } from "@/lib/assistant/conversation-auth";
import { createConversation, listConversations, type AiConversationContext } from "@/lib/assistant/conversation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/conversations?archived=1 — conversations de l'utilisateur (résumés). */
export async function GET(req: NextRequest) {
  const auth = await resolveAssistantUser(req);
  if (auth.deny) return auth.deny;
  try {
    const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
    const conversations = await listConversations(auth.userId, { includeArchived });
    return NextResponse.json({ conversations });
  } catch (error) {
    return jsonError("Impossible de lister les conversations.", error);
  }
}

/** POST /api/ai/conversations — crée une conversation (titre/contexte facultatifs). */
export async function POST(req: NextRequest) {
  const auth = await resolveAssistantUser(req);
  if (auth.deny) return auth.deny;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      context?: AiConversationContext | null;
      model?: string | null;
      provider?: string | null;
    };
    const conversation = await createConversation(auth.userId, {
      title: body.title,
      context: body.context ?? null,
      model: body.model ?? null,
      provider: body.provider ?? null,
    });
    return NextResponse.json({ conversation });
  } catch (error) {
    return jsonError("Impossible de créer la conversation.", error);
  }
}
