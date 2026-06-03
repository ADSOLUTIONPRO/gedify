import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import {
  listHiddenSenders,
  hideSender,
  hideSendersBulk,
  clearAllHiddenSenders,
} from "@/lib/messaging/hidden-senders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const senders = await listHiddenSenders();
  return NextResponse.json({ ok: true, senders });
}

export async function POST(request: NextRequest) {
  let body: { email?: string; displayName?: string; reason?: string; bulk?: { email: string; displayName?: string }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  // Masquage en masse
  if (Array.isArray(body.bulk) && body.bulk.length > 0) {
    const result = await hideSendersBulk(body.bulk);
    return NextResponse.json({ ok: true, ...result });
  }

  // Masquage unitaire
  if (!body.email) {
    return NextResponse.json({ error: "email requis." }, { status: 400 });
  }
  const sender = await hideSender(body.email, body.displayName ?? null, body.reason ?? null);
  return NextResponse.json({ ok: true, sender });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get("confirm");
  if (confirm === "CLEAR_ALL") {
    const count = await clearAllHiddenSenders();
    return NextResponse.json({ ok: true, cleared: count });
  }
  return NextResponse.json({ error: "Paramètre confirm manquant. Envoyez ?confirm=CLEAR_ALL." }, { status: 400 });
}
