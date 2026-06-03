import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getAccountWithSecret,
  getDecryptedPassword,
} from "@/lib/mail-connector/account-store";
import { testImapConnection } from "@/lib/mail-connector/test-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const account = await getAccountWithSecret(id);
    if (!account) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }

    if (account.authType !== "imap-password") {
      return NextResponse.json(
        {
          result: {
            ok: false,
            code: "imap-not-implemented",
            message: "OAuth Gmail/Outlook à connecter pour ce compte.",
            durationMs: 0,
          },
        },
        { status: 200 },
      );
    }

    let password: string | null = null;
    try {
      const body = (await request.json().catch(() => ({}))) as { password?: string };
      if (typeof body?.password === "string" && body.password.length > 0) {
        password = body.password;
      }
    } catch {
      // no body
    }

    if (!password) {
      password = await getDecryptedPassword(id);
    }

    const result = await testImapConnection(account, password);
    return NextResponse.json({ result });
  } catch (error) {
    return jsonError("Impossible de tester la connexion", error);
  }
}
