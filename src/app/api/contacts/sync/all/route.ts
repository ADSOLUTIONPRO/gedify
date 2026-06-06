import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { syncAllContacts } from "@/lib/contacts/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/sync/all — « Tout synchroniser » : Google People + détection
 * emails en un appel. Best-effort : un échec d'une source n'empêche pas l'autre.
 */
export async function POST() {
  try {
    const { google, email } = await syncAllContacts();
    const createdGoogle = google.ok ? google.synced : 0;
    const createdEmail = email.ok ? email.created : 0;
    return NextResponse.json({
      ok: google.ok || email.ok,
      google: google.ok
        ? { ok: true, synced: google.synced }
        : { ok: false, errorType: google.errorType, message: google.message },
      email: email.ok
        ? { ok: true, detected: email.detected, created: email.created }
        : { ok: false, errorType: email.errorType, message: email.message },
      totalSynced: createdGoogle + createdEmail,
    });
  } catch (error) {
    return jsonError("Synchronisation globale des contacts impossible", error);
  }
}
