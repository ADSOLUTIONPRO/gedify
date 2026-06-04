import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getAssistantSettings, saveAssistantSettings } from "@/lib/assistant/assistant-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  return NextResponse.json(await getAssistantSettings());
}

export async function PUT(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const saved = await saveAssistantSettings(body as Record<string, unknown>);
  return NextResponse.json(saved);
}
