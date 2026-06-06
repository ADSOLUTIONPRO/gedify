import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { syncGoogleContacts } from "@/lib/contacts/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Synchronisation Google People API (logique dans @/lib/contacts/sync). */
export async function POST() {
  try {
    const r = await syncGoogleContacts();
    if (r.ok) {
      return NextResponse.json({
        synced: r.synced,
        myContactsCount: r.myContactsCount,
        otherContactsCount: r.otherContactsCount,
      });
    }
    return NextResponse.json(
      { error: r.errorType, errorType: r.errorType, message: r.message },
      { status: r.httpStatus },
    );
  } catch (error) {
    return jsonError("Synchronisation des contacts Google impossible", error);
  }
}
