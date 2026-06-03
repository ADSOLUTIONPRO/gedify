import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { detectExistingGedDocument } from "@/lib/messaging/ged-attachment-match";
import {
  createMailDocumentLink,
  listMailDocumentLinks,
  updateMailDocumentLink,
  type MailDocumentLinkStatus,
} from "@/lib/messaging/mail-document-links-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DetectItem = {
  mailId: string;
  threadId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
};

type DetectResult = { status: MailDocumentLinkStatus | "none"; documentId: number | null; documentTitle: string | null };

/** Limite pour éviter de surcharger Gedify sur un seul appel. */
const MAX_ITEMS = 60;

/**
 * Détecte, pour un lot de pièces jointes, si elles existent déjà dans la GED
 * (Gedify) par correspondance de nom de fichier. Si oui, crée/MAJ la liaison
 * (mail ↔ thread ↔ document Gedify) et renvoie l'état GED par clé
 * `mailId:attachmentId`. Ne télécharge ni ne ré-importe rien.
 */
export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: { items?: DetectItem[] };
  try {
    body = (await request.json()) as { items?: DetectItem[] };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const items = (body.items ?? []).filter((i) => i?.mailId && i?.attachmentId && i?.filename).slice(0, MAX_ITEMS);
  if (items.length === 0) return NextResponse.json({ results: {} });

  const account = await getActiveGmailAccount();
  if (!account) {
    return NextResponse.json({ error: "Aucun compte Gmail connecté." }, { status: 412 });
  }

  // Liaisons existantes du compte (un seul accès disque).
  const existingLinks = await listMailDocumentLinks({ accountId: account.accountId });
  const linkByKey = new Map(
    existingLinks.filter((l) => l.attachmentId).map((l) => [`${l.mailId}:${l.attachmentId}`, l]),
  );

  try {
    const results: Record<string, DetectResult> = {};

    await Promise.all(
      items.map(async (item) => {
        const key = `${item.mailId}:${item.attachmentId}`;
        const existing = linkByKey.get(key);

        // Déjà importée / liée : on renvoie l'état connu sans rechercher.
        if (existing && (existing.status === "imported" || existing.status === "pending")) {
          results[key] = {
            status: existing.status,
            documentId: existing.paperlessDocumentId,
            documentTitle: existing.documentTitle,
          };
          return;
        }

        // Recherche d'un document GED correspondant.
        const match = await detectExistingGedDocument(item.filename, item.mimeType);
        if (!match) {
          results[key] = { status: existing?.status ?? "none", documentId: null, documentTitle: null };
          return;
        }

        // Document trouvé → on enregistre réellement la liaison.
        if (existing) {
          await updateMailDocumentLink(existing.id, {
            status: "imported",
            paperlessDocumentId: match.documentId,
            documentTitle: match.documentTitle,
            errorMessage: null,
          });
        } else {
          await createMailDocumentLink({
            accountId: account.accountId,
            mailId: item.mailId,
            threadId: item.threadId,
            attachmentId: item.attachmentId,
            filename: item.filename,
            mimeType: item.mimeType,
            sizeBytes: item.sizeBytes ?? null,
            paperlessDocumentId: match.documentId,
            documentTitle: match.documentTitle,
            status: "imported",
            errorMessage: null,
          });
        }
        results[key] = { status: "imported", documentId: match.documentId, documentTitle: match.documentTitle };
      }),
    );

    return NextResponse.json({ results });
  } catch (error) {
    return jsonError("Détection GED des pièces jointes impossible", error);
  }
}
