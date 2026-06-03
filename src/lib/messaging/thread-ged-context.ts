import "server-only";

import { getDocuments, getDocumentTypes, getTags } from "@/lib/paperless";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";
import { listEmailLinks } from "@/lib/messaging/email-ged-link-store";
import { listMailDocumentLinks, type MailDocumentLinkStatus } from "@/lib/messaging/mail-document-links-store";
import { listProjectFolders } from "@/lib/projects/project-store";
import type { EmailGedLink } from "@/lib/messaging/email-types";

export type AttachmentStatusInfo = { status: MailDocumentLinkStatus | "none"; documentId: number | null };

export type CorrespondentDoc = {
  id: number;
  title: string;
  type: string | null;
  created: string | null;
  tags: string[];
};

export type ThreadGedContext = {
  /** Statut GED par PJ, indexé par attachmentId. */
  attachmentStatusByAttId: Record<string, AttachmentStatusInfo>;
  /** Statut GED par PJ, indexé par nom de fichier (repli : l'attachmentId Gmail peut changer entre fetches). */
  attachmentStatusByFilename: Record<string, AttachmentStatusInfo>;
  /** Documents créés depuis les PJ importées de ce thread (documentId parfois null : import async). */
  importedDocs: { documentId: number | null; filename: string }[];
  correspondent: { id: number; name: string } | null;
  correspondentDocs: CorrespondentDoc[];
  folders: { id: string; name: string }[];
  links: EmailGedLink[];
};

/**
 * Contexte GED d'un thread mail : statut des pièces jointes, liaisons enregistrées,
 * correspondant résolu + ses documents/dossiers GED. Tout est calculé côté serveur
 * à partir des stores de liaison (et non de l'état local des boutons).
 */
export async function loadThreadGedContext(
  threadId: string,
  accountId: string,
  participantEmails: string[],
): Promise<ThreadGedContext> {
  const [attLinks, links, contacts] = await Promise.all([
    listMailDocumentLinks({ threadId }),
    listEmailLinks({ scope: "thread", emailId: threadId }),
    listEmailContacts(accountId),
  ]);

  const attachmentStatusByAttId: Record<string, AttachmentStatusInfo> = {};
  const attachmentStatusByFilename: Record<string, AttachmentStatusInfo> = {};
  const importedDocs: { documentId: number | null; filename: string }[] = [];
  for (const l of attLinks) {
    const info: AttachmentStatusInfo = { status: l.status, documentId: l.paperlessDocumentId };
    if (l.attachmentId) attachmentStatusByAttId[l.attachmentId] = info;
    if (l.filename) attachmentStatusByFilename[l.filename] = info;
    if (l.status === "imported") {
      importedDocs.push({ documentId: l.paperlessDocumentId, filename: l.filename ?? `Document #${l.paperlessDocumentId ?? "?"}` });
    }
  }

  // ── Résolution du correspondant ─────────────────────────────────────────────
  let correspondent: { id: number; name: string } | null = null;
  const corrLink = links.find((x) => x.target.kind === "correspondent");
  if (corrLink && corrLink.target.kind === "correspondent") {
    correspondent = { id: corrLink.target.correspondentId, name: corrLink.target.correspondentName };
  } else {
    const emailSet = new Set(participantEmails.map((e) => e.toLowerCase()).filter(Boolean));
    const match = contacts.find(
      (c) => c.correspondentId && [c.email, ...(c.emails ?? [])].some((e) => e && emailSet.has(e.toLowerCase())),
    );
    if (match?.correspondentId) correspondent = { id: match.correspondentId, name: match.displayName };
  }

  // ── Documents + dossiers du correspondant ───────────────────────────────────
  let correspondentDocs: CorrespondentDoc[] = [];
  let folders: { id: string; name: string }[] = [];
  if (correspondent) {
    const [docsRes, types, tags, projects] = await Promise.all([
      getDocuments({ correspondent__id: correspondent.id, page_size: 8, ordering: "-created" }),
      getDocumentTypes(),
      getTags(),
      listProjectFolders(),
    ]);
    const typeList = types.results ?? [];
    const tagList = tags.results ?? [];
    correspondentDocs = (docsRes.results ?? []).map((d) => ({
      id: Number(d.id),
      title: d.title || `Document #${d.id}`,
      type: d.document_type__name ?? typeList.find((t) => t.id === d.document_type)?.name ?? null,
      created: d.created ?? null,
      tags: (d.tags ?? [])
        .map((tid) => tagList.find((t) => t.id === tid)?.name)
        .filter((x): x is string => Boolean(x))
        .slice(0, 3),
    }));
    const docIdSet = new Set(correspondentDocs.map((d) => d.id));
    const folderMap = new Map<string, string>();
    for (const p of projects) {
      if ((p.linkedDocumentIds ?? []).some((id) => docIdSet.has(id))) folderMap.set(p.id, p.name);
    }
    // Dossiers liés directement au thread (lien de classement projet).
    for (const link of links) {
      if (link.target.kind === "project") folderMap.set(link.target.projectId, link.target.projectName);
    }
    folders = [...folderMap.entries()].map(([id, name]) => ({ id, name }));
  } else {
    const folderMap = new Map<string, string>();
    for (const link of links) {
      if (link.target.kind === "project") folderMap.set(link.target.projectId, link.target.projectName);
    }
    folders = [...folderMap.entries()].map(([id, name]) => ({ id, name }));
  }

  return { attachmentStatusByAttId, attachmentStatusByFilename, importedDocs, correspondent, correspondentDocs, folders, links };
}
