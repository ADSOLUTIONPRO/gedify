import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createAccount, listAccounts } from "@/lib/mail-connector/account-store";
import type { MailAccountInput } from "@/lib/mail-connector/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await listAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    return jsonError("Impossible de lister les comptes mail", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MailAccountInput;
    const account = await createAccount(body);

    // Relève initiale en ARRIÈRE-PLAN : sinon un compte fraîchement ajouté ne
    // fait rien (aucun mail relevé, aucune PJ importée) tant qu'aucune synchro
    // n'est déclenchée. Fire-and-forget : ne bloque pas la réponse, n'échoue pas
    // la création si l'IMAP est momentanément indisponible.
    if (account.authType === "imap-password" && account.isActive) {
      void import("@/lib/mail-connector/sync-mail-account")
        .then(({ syncMailAccount }) => syncMailAccount(account.id))
        .catch(() => {});
    }

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible de créer le compte mail", error);
  }
}
