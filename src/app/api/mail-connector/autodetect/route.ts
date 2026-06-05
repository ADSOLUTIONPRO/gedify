import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { autodetectImap } from "@/lib/mail-connector/autodetect";

/* Auto-détection des réglages IMAP depuis une adresse email. Lecture seule. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  const email = request.nextUrl.searchParams.get("email") ?? "";
  try {
    const detect = await autodetectImap(email);
    if (!detect) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    return NextResponse.json({ detect });
  } catch (error) {
    return jsonError("Auto-détection impossible", error);
  }
}
