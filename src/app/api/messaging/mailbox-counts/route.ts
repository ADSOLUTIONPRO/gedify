import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getMailboxCounts } from "@/lib/messaging/mailbox-counts";

/* Compteurs « Courriels à traiter » par boîte (§17). Estimation Gmail +
   comptage local IMAP, mis en cache court côté serveur. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { total, boxes } = await getMailboxCounts();
    return NextResponse.json({ total, boxes });
  } catch (error) {
    return jsonError("Compteurs des boîtes indisponibles", error);
  }
}
