import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getAccountWithSecret,
  getDecryptedPassword,
} from "@/lib/mail-connector/account-store";
import { listFolders } from "@/lib/mail-connector/test-account";

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
        { folders: [], message: "OAuth à connecter pour ce compte." },
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
    if (!password) {
      return NextResponse.json(
        { folders: [], message: "Aucun mot de passe disponible." },
        { status: 200 },
      );
    }

    const folders = await listFolders(account, password);
    return NextResponse.json({ folders });
  } catch (error) {
    return jsonError("Impossible de lister les dossiers IMAP", error);
  }
}
