import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { listSendableAccounts } from "@/lib/messaging/sendable-accounts";

/* Boîtes mail connectées (Google + IMAP) pour les sélecteurs « Boîte active » /
   « Expéditeur ». Lecture seule, aucun secret. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const accounts = await listSendableAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    return jsonError("Impossible de lister les boîtes mail", error);
  }
}
