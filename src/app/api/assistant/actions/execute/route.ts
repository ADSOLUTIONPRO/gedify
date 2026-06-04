import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { readSession } from "@/lib/auth/session";
import { executeAction } from "@/lib/assistant/assistant-actions";
import { sanitizeAction } from "@/lib/assistant/assistant-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  if (!action) return NextResponse.json({ ok: false, error: "Action invalide." }, { status: 400 });

  const session = await readSession();
  const result = await executeAction(action, session?.username ?? null);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
