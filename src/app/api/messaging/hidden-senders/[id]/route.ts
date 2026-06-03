import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { restoreSender } from "@/lib/messaging/hidden-senders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ok = await restoreSender(id);
  if (!ok) return NextResponse.json({ error: "Expéditeur introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
