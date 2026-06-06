import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { syncEmailContacts } from "@/lib/contacts/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/sync/email — détecte les contacts depuis les emails
 * synchronisés (expéditeurs/destinataires). Simulation safe : ne modifie aucun
 * email, dédup par adresse. Logique dans @/lib/contacts/sync.
 */
export async function POST() {
  try {
    const r = await syncEmailContacts();
    if (r.ok) {
      return NextResponse.json({ detected: r.detected, created: r.created, skippedDuplicates: r.skippedDuplicates });
    }
    return NextResponse.json({ error: r.errorType, errorType: r.errorType, message: r.message }, { status: r.httpStatus });
  } catch (error) {
    return jsonError("Détection des contacts depuis les emails impossible", error);
  }
}
