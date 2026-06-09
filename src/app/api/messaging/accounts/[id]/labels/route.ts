import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getAccount } from "@/lib/mail-connector/account-store";
import { resolveGmailFolders } from "@/lib/messaging/mail-folder-inclusion";
import { setFolderPref } from "@/lib/messaging/mail-folder-prefs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function isGmail(account: { connector?: string | null; authType?: string | null } | null): boolean {
  return Boolean(account && (account.connector === "gmail-oauth" || account.authType === "oauth-gmail"));
}

/** Dossiers/labels classés du compte (inclus / exclus système / exclus manuels). */
export async function GET(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const account = await getAccount(id);
    if (!account) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    if (!isGmail(account)) {
      // Les comptes IMAP gèrent l'inclusion via folderRules (watched/excluded).
      return NextResponse.json({ provider: "imap", folders: [], message: "Configuration des dossiers gérée dans les règles IMAP." });
    }
    const folders = await resolveGmailFolders(id);
    return NextResponse.json({ provider: "gmail", folders });
  } catch (error) {
    return jsonError("Lecture des dossiers impossible", error);
  }
}

/** Inclure/exclure un dossier non système dans « Courriels à traiter ». */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const account = await getAccount(id);
    if (!account) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    if (!isGmail(account)) return NextResponse.json({ error: "Compte non Gmail." }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as { folderId?: string; folderName?: string; included?: boolean };
    if (!body.folderId || !body.folderName) {
      return NextResponse.json({ error: "folderId et folderName requis." }, { status: 400 });
    }

    // Sécurité : on ne touche jamais aux dossiers système (verrouillés).
    const folders = await resolveGmailFolders(id);
    const target = folders.find((f) => f.id === body.folderId);
    if (!target) return NextResponse.json({ error: "Dossier inconnu." }, { status: 404 });
    if (target.locked) return NextResponse.json({ error: "Dossier système verrouillé." }, { status: 409 });

    await setFolderPref(id, body.folderId, body.folderName, body.included !== false);
    return NextResponse.json({ ok: true, folderId: body.folderId, included: body.included !== false });
  } catch (error) {
    return jsonError("Mise à jour du dossier impossible", error);
  }
}
