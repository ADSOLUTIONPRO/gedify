import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getAccount,
  updateAccount,
} from "@/lib/mail-connector/account-store";
import type {
  MailAttachmentRules,
  MailFolderRules,
  MailSenderFilter,
} from "@/lib/mail-connector/mail-filter-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  folderRules?: MailFolderRules | null;
  senderFilter?: MailSenderFilter | null;
  attachmentRules?: MailAttachmentRules | null;
};

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const account = await getAccount(id);
    if (!account) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    return NextResponse.json({
      folderRules: account.folderRules,
      senderFilter: account.senderFilter,
      attachmentRules: account.attachmentRules,
    });
  } catch (error) {
    return jsonError("Impossible de lire les filtres", error);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Body;
    const updated = await updateAccount(id, body);
    if (!updated) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    return NextResponse.json({ account: updated });
  } catch (error) {
    return jsonError("Impossible de mettre à jour les filtres", error);
  }
}
