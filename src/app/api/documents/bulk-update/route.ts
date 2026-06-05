import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { recordAudit } from "@/lib/audit/audit-store";
import { getDocument, updateDocument } from "@/lib/paperless";
import { listProjectFolders } from "@/lib/projects/project-store";

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

type BulkUpdateResult = {
  ok: boolean;
  updated: number;
  failed: number;
  errors: { id: number; message: string }[];
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

  const result: BulkUpdateResult = { ok: true, updated: 0, failed: 0, errors: [] };
  const { patch } = body;

  // Tags miroir des dossiers/projets (« Dossier - … ») : à PRÉSERVER toujours,
  // pour qu'un « vider » / « retirer » de tags ne casse jamais le classement GED.
  const projectTagIds = new Set<number>(
    (await listProjectFolders())
      .map((p) => p.paperlessTagId)
      .filter((x): x is number => typeof x === "number"),
  );

  for (const id of body.documentIds) {
    try {
      const payload: Record<string, unknown> = {};

      // Correspondant
      if (patch.correspondentOp === "replace") payload.correspondent = patch.correspondentId ?? null;
      else if (patch.correspondentOp === "clear") payload.correspondent = null;

      // Type de document
      if (patch.typeOp === "replace") payload.document_type = patch.typeId ?? null;
      else if (patch.typeOp === "clear") payload.document_type = null;

      // Date document
      if (patch.createdOp === "replace") payload.created = patch.created ?? null;
      else if (patch.createdOp === "clear") payload.created = null;

      // ASN
      if (patch.asnOp === "replace") payload.archive_serial_number = patch.asn ?? null;
      else if (patch.asnOp === "clear") payload.archive_serial_number = null;

      // Notes
      if (patch.notesOp === "replace" && patch.notes !== undefined) payload.notes = patch.notes;

      // Tags — on lit toujours l'état courant pour PRÉSERVER les tags de dossier/projet.
      if (patch.tagOp && patch.tagIds !== undefined) {
        const current = await getDocument(String(id));
        const currentTagIds: number[] = current.tags ?? [];
        const keepProjectTags = currentTagIds.filter((t) => projectTagIds.has(t));
        if (patch.tagOp === "clear") {
          // « Vider » : ne retire QUE les tags hors dossier/projet.
          payload.tags = keepProjectTags;
        } else if (patch.tagOp === "replace") {
          // « Remplacer » : tags choisis + tags de dossier/projet conservés.
          payload.tags = Array.from(new Set([...patch.tagIds, ...keepProjectTags]));
        } else if (patch.tagOp === "add") {
          payload.tags = Array.from(new Set([...currentTagIds, ...patch.tagIds]));
        } else {
          // « Retirer » : enlève les tags choisis, sauf ceux de dossier/projet.
          const removeSet = new Set(patch.tagIds);
          payload.tags = currentTagIds.filter((t) => !removeSet.has(t) || projectTagIds.has(t));
        }
      }

      if (Object.keys(payload).length > 0) {
        await updateDocument(String(id), payload as Parameters<typeof updateDocument>[1]);
        result.updated++;
      }
    } catch (err) {
      result.failed++;
      result.errors.push({
        id,
        message: err instanceof Error ? err.message : String(err),
      });
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
