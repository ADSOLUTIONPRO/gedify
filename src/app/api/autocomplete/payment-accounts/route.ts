import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * No persistence layer yet for payment accounts. Returns an empty list with a clear
 * "à connecter" marker so the UI can fall back to free-text input.
 */
export async function GET() {
  return NextResponse.json({
    items: [],
    notConfigured: true,
    message:
      "Aucun store de comptes de paiement n'est encore configuré. À connecter quand le module sera disponible.",
  });
}
