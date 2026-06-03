import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getAccountWithSecret } from "@/lib/mail-connector/account-store";
import { syncGmailAccount } from "@/lib/connectors/gmail/sync-gmail-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { accountId: string };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.accountId) {
      return NextResponse.json({ error: "accountId requis." }, { status: 400 });
    }
    const account = await getAccountWithSecret(body.accountId);
    if (!account) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }
    if (account.connector !== "gmail-oauth") {
      return NextResponse.json(
        {
          error: "Mauvais connecteur",
          message: "Ce compte n'est pas un compte Gmail OAuth.",
        },
        { status: 400 },
      );
    }
    const result = await syncGmailAccount(account);
    return NextResponse.json({ result });
  } catch (error) {
    return jsonError("Synchronisation Gmail impossible", error);
  }
}
