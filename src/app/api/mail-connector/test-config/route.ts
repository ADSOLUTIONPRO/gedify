import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { testImapConnection } from "@/lib/mail-connector/test-account";
import type { MailEncryption } from "@/lib/mail-connector/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestConfigInput = {
  imapHost: string;
  imapPort: number;
  encryption: MailEncryption;
  username: string;
  watchedFolder: string;
  password: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<TestConfigInput>;
    const account = {
      imapHost: body.imapHost ?? "",
      imapPort: typeof body.imapPort === "number" ? body.imapPort : 993,
      encryption: (body.encryption ?? "tls") as MailEncryption,
      username: body.username ?? "",
      watchedFolder: body.watchedFolder ?? "INBOX",
    };
    if (!body.password) {
      return NextResponse.json({
        result: {
          ok: false,
          code: "missing-password",
          message: "Mot de passe requis pour ce test.",
          durationMs: 0,
        },
      });
    }
    const result = await testImapConnection(account, body.password);
    return NextResponse.json({ result });
  } catch (error) {
    return jsonError("Impossible de tester cette configuration", error);
  }
}
