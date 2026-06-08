import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { recordAudit } from "@/lib/audit/audit-store";
import { readSession } from "@/lib/auth/session";
import { getDocument, updateDocument } from "@/lib/paperless";
import { listProjectFolders } from "@/lib/projects/project-store";
import { createDocumentNote } from "@/lib/documents/document-notes-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TagOperation = "replace" | "add" | "remove" | "clear";
type FieldOperation = "replace" | "clear" | "keep";

type BulkUpdateBody = {
  documentIds: number[];
  patch: {
    correspondentId?: number | null;
    correspondentOp?: FieldOperation;
    typeId?: number | null;
    typeOp?: FieldOperation;
    tagIds?: number[];
    tagOp?: TagOperation;
    created?: string | null;
    createdOp?: FieldOperation;
    notes?: string;
    notesOp?: FieldOperation;
    asn?: string | null;
    asnOp?: FieldOperation;
  };
};

type FieldChange = { previousId: number | null; newId: number | null };
type BulkItemResult = {
  documentId: number;
  success: boolean;
  changes?: { documentType?: FieldChange; correspondent?: FieldChange };
  message?: string;
};

type BulkUpdateResult = {
  ok: boolean;
  updated: number;
  failed: number;
  errors: { id: number; message: string }[];
  items: BulkItemResult[];
};

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: BulkUpdateBody;
  try {
    body = (await request.json()) as BulkUpdateBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!Array.isArray(body.documentIds) || body.documentIds.length === 0) {
    return NextResponse.json({ error: "documentIds requis." }, { status: 400 });
  }

  const result: BulkUpdateResult = { ok: true, updated: 0, failed: 0, errors: [], items: [] };
  const { patch } = body;
  const session = await readSession();

  // Tags miroir des dossiers/projets (« Dossier - … ») : à PRÉSERVER toujours,
  // pour qu'un « vider » / « retirer » de tags ne casse jamais le classement GED.
  const projectTagIds = new Set<number>(
    (await listProjectFolders())
      .map((p) => p.paperlessTagId)
      .filter((x): x is number => typeof x === "number"),
  );

  const needsCurrent = Boolean(patch.tagOp) || patch.typeOp === "replace" || patch.correspondentOp === "replace";

  for (const id of body.documentIds) {
    try {
      const payload: Record<string, unknown> = {};
      const changes: BulkItemResult["changes"] = {};
      // Lecture de l'état courant (tags à préserver + diagnostics avant/après).
      const current = needsCurrent ? await getDocument(String(id)) : null;
      const prevType = typeof current?.document_type === "number" ? current.document_type : null;
      const prevCorr = typeof current?.correspondent === "number" ? current.correspondent : null;

      // Correspondant
      if (patch.correspondentOp === "replace") { payload.correspondent = patch.correspondentId ?? null; changes.correspondent = { previousId: prevCorr, newId: patch.correspondentId ?? null }; }
      else if (patch.correspondentOp === "clear") payload.correspondent = null;

      // Type de document — REMPLACE réellement l'ancienne valeur en base.
      if (patch.typeOp === "replace") { payload.document_type = patch.typeId ?? null; changes.documentType = { previousId: prevType, newId: patch.typeId ?? null }; }
      else if (patch.typeOp === "clear") payload.document_type = null;

      // Date document
      if (patch.createdOp === "replace") payload.created = patch.created ?? null;
      else if (patch.createdOp === "clear") payload.created = null;

      // ASN
      if (patch.asnOp === "replace") payload.archive_serial_number = patch.asn ?? null;
      else if (patch.asnOp === "clear") payload.archive_serial_number = null;

      // Tags — préserve toujours les tags miroir de dossier/projet.
      if (patch.tagOp && patch.tagIds !== undefined && current) {
        const currentTagIds: number[] = current.tags ?? [];
        const keepProjectTags = currentTagIds.filter((t) => projectTagIds.has(t));
        if (patch.tagOp === "clear") {
          payload.tags = keepProjectTags;
        } else if (patch.tagOp === "replace") {
          payload.tags = Array.from(new Set([...patch.tagIds, ...keepProjectTags]));
        } else if (patch.tagOp === "add") {
          payload.tags = Array.from(new Set([...currentTagIds, ...patch.tagIds]));
        } else {
          const removeSet = new Set(patch.tagIds);
          payload.tags = currentTagIds.filter((t) => !removeSet.has(t) || projectTagIds.has(t));
        }
      }

      let touched = false;
      if (Object.keys(payload).length > 0) {
        await updateDocument(String(id), payload as Parameters<typeof updateDocument>[1]);
        touched = true;
        if (changes.documentType) console.log(`[bulk-update] doc=${id} document_type ${changes.documentType.previousId} -> ${changes.documentType.newId}`);
        if (changes.correspondent) console.log(`[bulk-update] doc=${id} correspondent ${changes.correspondent.previousId} -> ${changes.correspondent.newId}`);
      }

      // Notes : modèle dédié (commentaire), pas le champ document → vraie persistance.
      if (patch.notesOp === "replace" && patch.notes?.trim()) {
        await createDocumentNote(id, { content: patch.notes.trim(), author: session?.username ?? null }).catch(() => {});
        touched = true;
      }

      if (touched) result.updated++;
      result.items.push({ documentId: id, success: true, changes: Object.keys(changes).length ? changes : undefined });
    } catch (err) {
      result.failed++;
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ id, message });
      result.items.push({ documentId: id, success: false, message });
    }
  }

  if (result.failed > 0) result.ok = result.updated > 0;

  // Journalisation de l'action groupée (Partie 6 — traçabilité). Best-effort.
  const ops: string[] = [];
  if (patch.correspondentOp === "replace" || patch.correspondentOp === "clear") ops.push("correspondant");
  if (patch.typeOp === "replace" || patch.typeOp === "clear") ops.push("type");
  if (patch.tagOp) ops.push(`tags(${patch.tagOp})`);
  if (patch.createdOp === "replace" || patch.createdOp === "clear") ops.push("date");
  if (patch.asnOp === "replace" || patch.asnOp === "clear") ops.push("ASN");
  if (patch.notesOp === "replace") ops.push("notes");
  await recordAudit({
    action: "documents.bulk_update",
    target: `${body.documentIds.length} document(s)`,
    result: result.failed > 0 ? (result.updated > 0 ? "success" : "error") : "success",
    details: `${result.updated} modifié(s), ${result.failed} échec(s)${ops.length ? ` — ${ops.join(", ")}` : ""}`,
  });

  return NextResponse.json(result);
}
