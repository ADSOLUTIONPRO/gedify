import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { createGmailDraft, updateGmailDraft, deleteGmailDraft } from "@/lib/connectors/gmail/gmail-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DraftBody = {
  draftId?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
};

/** POST → créer ou mettre à jour un brouillon */
export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: DraftBody;
  try {
    body = (await request.json()) as DraftBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!body.to || !body.subject) {
    return NextResponse.json({ error: "to et subject requis." }, { status: 400 });
  }

  const account = await getActiveGmailAccount();
  if (!account) return NextResponse.json({ error: "Aucun compte Gmail connecté." }, { status: 503 });

  try {
    const opts = { threadId: body.threadId, inReplyTo: body.inReplyTo, cc: body.cc, bcc: body.bcc, html: true };
    let draft;
    if (body.draftId) {
      draft = await updateGmailDraft(account.accountId, body.draftId, body.to, body.subject, body.body ?? "", opts);
    } else {
      draft = await createGmailDraft(account.accountId, body.to, body.subject, body.body ?? "", opts);
    }
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return jsonError("Erreur brouillon Gmail", error);
  }
}

/** DELETE → supprimer un brouillon */
export async function DELETE(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const { searchParams } = new URL(request.url);
  const draftId = searchParams.get("draftId");
  if (!draftId) return NextResponse.json({ error: "draftId requis." }, { status: 400 });

  const account = await getActiveGmailAccount();
  if (!account) return NextResponse.json({ error: "Aucun compte Gmail connecté." }, { status: 503 });

  try {
    await deleteGmailDraft(account.accountId, draftId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Erreur suppression brouillon", error);
  }
}
