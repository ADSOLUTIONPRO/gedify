import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { createEmailLink, deleteEmailLink, listEmailLinks } from "@/lib/messaging/email-ged-link-store";
import type { EmailGedLink, EmailGedLinkTarget } from "@/lib/messaging/email-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  const sp = request.nextUrl.searchParams;
  const emailId = sp.get("emailId") ?? undefined;
  const scopeParam = sp.get("scope");
  const scope = scopeParam === "message" || scopeParam === "thread" ? scopeParam : undefined;
  try {
    return NextResponse.json({ links: await listEmailLinks({ emailId, scope }) });
  } catch (error) {
    return jsonError("Liste des liaisons impossible", error);
  }
}

type PostBody = {
  /** thread id (scope=thread) ou message id (scope=message). */
  emailId: string;
  scope?: EmailGedLink["scope"];
  target: EmailGedLinkTarget;
  /** Lien en masse : plusieurs emails vers la même cible. */
  emailIds?: string[];
};

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const ids = body.emailIds?.length ? body.emailIds : body.emailId ? [body.emailId] : [];
  if (ids.length === 0 || !body.target?.kind) {
    return NextResponse.json({ error: "emailId(s) et target requis." }, { status: 400 });
  }

  const account = await getActiveGmailAccount();
  const accountId = account?.accountId ?? "";

  try {
    const links: EmailGedLink[] = [];
    for (const emailId of ids) {
      links.push(
        await createEmailLink({
          emailId,
          scope: body.scope ?? "thread",
          accountId,
          target: body.target,
          source: "user",
        }),
      );
    }
    return NextResponse.json({ links, count: links.length }, { status: 201 });
  } catch (error) {
    return jsonError("Création de la liaison impossible", error);
  }
}

export async function DELETE(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });
  try {
    await deleteEmailLink(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Suppression de la liaison impossible", error);
  }
}
