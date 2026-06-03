import "server-only";

import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { readSession } from "@/lib/auth/session";
import { createPaperlessObject, getDocument, getTags, paperlessFetch, updateDocument } from "@/lib/paperless";
import { appendGedLog } from "@/lib/ged/ged-store";
import { createDocumentSignature, type SignatureMethod } from "@/lib/documents/document-signature-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type PaperlessTaskResponse = { id?: string | number; uuid?: string; related_document?: number | null; status?: string };

function normName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Résout (ou crée) le tag « signé » et renvoie son id. */
async function resolveSignedTagId(): Promise<number | null> {
  try {
    const tags = (await getTags({ page_size: 1000 })).results ?? [];
    const match = tags.find((t) => normName(t.name) === normName("signé"));
    if (match) return Number(match.id);
    const created = await createPaperlessObject<{ id: number }>("/api/tags/", { name: "signé" });
    return Number(created.id);
  } catch {
    return null;
  }
}

async function pollRelatedDocument(taskId: string): Promise<number | null> {
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 1300));
    try {
      const tasks = await paperlessFetch<PaperlessTaskResponse[]>(`/api/tasks/?task_id=${encodeURIComponent(taskId)}`);
      const task = Array.isArray(tasks) ? tasks[0] : null;
      if (task?.related_document) return Number(task.related_document);
      if (task?.status && /FAILURE/i.test(task.status)) return null;
    } catch {
      /* on continue le polling */
    }
  }
  return null;
}

async function addNote(documentId: number, note: string): Promise<void> {
  try {
    await paperlessFetch(`/api/documents/${documentId}/notes/`, { method: "POST", body: { note } });
  } catch {
    /* best-effort */
  }
}

/**
 * Enregistre une **version signée** (PDF généré côté client) d'un document :
 * upload Gedify, tag « signé », titre, liaison à l'original, historique et
 * notes réciproques. N'écrase jamais l'original.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  try {
    const { id } = await params;
    const originalId = Number(id);
    if (!Number.isFinite(originalId)) {
      return NextResponse.json({ error: "documentId invalide." }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("document");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "PDF signé manquant (champ `document`)." }, { status: 400 });
    }

    const method = (form.get("method") as SignatureMethod) || "draw";
    const page = Number(form.get("page") ?? 1) || 1;
    let coords: { x: number; y: number; w: number; h: number } | null = null;
    try { coords = JSON.parse(String(form.get("coords") ?? "null")); } catch { coords = null; }

    // Métadonnées de l'éditeur (pour l'historique).
    const num = (k: string) => { const n = Number(form.get(k)); return Number.isFinite(n) ? n : 0; };
    const meta = {
      pages: num("pages"),
      paraphes: num("paraphes"),
      signatures: num("signatures"),
      hasDate: form.get("hasDate") === "true",
      lieu: (form.get("lieu") as string) || "",
      photos: num("photos"),
    };

    // Titre du document signé.
    const original = await getDocument(originalId).catch(() => null);
    const baseTitle = (original?.title ?? `Document ${originalId}`).replace(/\.pdf$/i, "");
    const signedTitle = `${baseTitle} — signé`;
    const fileName = `${baseTitle}-signe.pdf`;

    // Hash du PDF signé.
    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");

    // Upload Gedify.
    const uploadForm = new FormData();
    uploadForm.append("document", new Blob([bytes], { type: "application/pdf" }), fileName);
    const task = await paperlessFetch<PaperlessTaskResponse>("/api/documents/post_document/", { method: "POST", body: uploadForm });
    const taskId = String(task?.id ?? task?.uuid ?? "");

    // Récupérer l'id du nouveau document (best-effort).
    const signedDocumentId = taskId ? await pollRelatedDocument(taskId) : null;

    // Tag « signé » + titre sur le document signé (si résolu).
    if (signedDocumentId) {
      const tagId = await resolveSignedTagId();
      const patch: { title: string; tags?: number[] } = { title: signedTitle };
      if (tagId) patch.tags = [tagId];
      await updateDocument(signedDocumentId, patch).catch(() => {});
    }

    const session = await readSession();
    const user = session?.username ?? null;

    // Liaison persistée.
    await createDocumentSignature({
      originalDocumentId: originalId,
      signedDocumentId,
      signedTitle,
      user,
      method,
      page,
      coords,
      hash,
    });

    // Notes réciproques + historique.
    if (signedDocumentId) {
      await addNote(originalId, `Version signée créée : document #${signedDocumentId} (${signedTitle}).`);
      await addNote(signedDocumentId, `Document signé à partir de l'original #${originalId}.`);
    }
    const parts = [
      meta.pages ? `${meta.pages} page(s)` : null,
      meta.paraphes ? `${meta.paraphes} paraphe(s)` : null,
      meta.signatures ? `${meta.signatures} signature(s)` : null,
      meta.hasDate ? "date" : null,
      meta.lieu ? `lieu=${meta.lieu}` : null,
      meta.photos ? `${meta.photos} photo(s)` : null,
    ].filter(Boolean);
    await appendGedLog({
      level: "success",
      source: "GED",
      documentId: originalId,
      user,
      message: `Document signé — ${user ?? "Système"} — Version signée créée${signedDocumentId ? ` (#${signedDocumentId})` : ""}${parts.length ? ` · ${parts.join(", ")}` : " · signature visuelle"}`,
      details: `hash=${hash.slice(0, 16)}… page=${page} méthode=${method}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, signedDocumentId, signedTitle, taskId, pending: !signedDocumentId });
  } catch (error) {
    return jsonError("Signature du document impossible", error);
  }
}
