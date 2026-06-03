import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { paperlessProxyError } from "@/lib/api-utils";
import { readSession } from "@/lib/auth/session";
import { getLatestAnalysisForDocument, upsertAnalysis } from "@/lib/ai/ai-analysis-store";
import { resolveClassification } from "@/lib/ai/resolve-classification";
import { computeDocumentFingerprint } from "@/lib/ai/document-fingerprint";
import { learnFromValidation } from "@/lib/ai/learned-templates-store";
import { getDocument, updateDocument } from "@/lib/paperless";
import { setTitleOverride } from "@/lib/documents/document-title-store";
import { linkProjectDocuments } from "@/lib/projects/project-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { getPrincipalType } from "@/lib/budget/finance-classification";
import { appendGedLog } from "@/lib/ged/ged-store";
import type { TemplateBudgetMapping } from "@/lib/ai/learned-templates-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Valeurs (éventuellement éditées dans la Fiche IA) à appliquer explicitement. */
type Overrides = {
  correspondentName?: string | null;
  documentTypeName?: string | null;
  tagNames?: string[];
  folderName?: string | null;
  title?: string | null;
  created?: string | null;
};

/**
 * Applique l'analyse IA au document Gedify.
 * - Sans `overrides` : ne remplit QUE les champs vides (sécurité règle #7).
 * - Avec `overrides` (validation explicite depuis la Fiche IA) : résout/crée les
 *   entités (sans doublon) et applique les valeurs choisies (peut écraser).
 * Journalise. Ne renvoie jamais 500 silencieux.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const documentId = Number(id);
    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "documentId invalide." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { overrides?: Overrides };
    const overrides = body.overrides;
    const session = await readSession();
    const user = session?.username ?? null;
    const doc = await getDocument(documentId);
    const existingTags = Array.isArray(doc.tags) ? (doc.tags as number[]) : [];

    // ── Application explicite des valeurs (éditées) depuis la Fiche IA ──
    if (overrides) {
      const resolved = await resolveClassification({
        correspondentName: overrides.correspondentName,
        documentTypeName: overrides.documentTypeName,
        tagNames: overrides.tagNames,
        folderName: overrides.folderName,
        ocrText: doc.content ?? "",
      });

      const patch: { correspondent?: number; document_type?: number; tags?: number[]; created?: string } = {};
      const applied: string[] = [];
      const created: string[] = [];

      if (resolved.correspondent) { patch.correspondent = resolved.correspondent.id; applied.push("correspondant"); if (resolved.correspondent.created) created.push(resolved.correspondent.name); }
      if (resolved.documentType) { patch.document_type = resolved.documentType.id; applied.push("type"); if (resolved.documentType.created) created.push(resolved.documentType.name); }
      if (resolved.tags.length > 0) {
        const ids = resolved.tags.map((t) => t.id);
        patch.tags = [...new Set([...existingTags, ...ids])]; // union non destructive
        applied.push("tags");
        for (const t of resolved.tags) if (t.created) created.push(t.name);
      }
      if (overrides.created) { patch.created = overrides.created; applied.push("date"); }
      if (Object.keys(patch).length > 0) await updateDocument(documentId, patch);

      if (overrides.title?.trim()) {
        await setTitleOverride(documentId, overrides.title.trim(), "user", null, true).catch(() => {});
        applied.push("titre");
      }
      if (resolved.folder) {
        await linkProjectDocuments(resolved.folder.id, [documentId]).catch(() => {});
        applied.push("dossier");
        if (resolved.folder.created) created.push(resolved.folder.name);
      }

      const latest = await getLatestAnalysisForDocument(documentId);
      if (latest) await upsertAnalysis({ ...latest, id: latest.id, status: "applied", appliedFields: applied, appliedAt: new Date().toISOString(), needsReview: false, classificationSource: "user" }).catch(() => {});

      await appendGedLog({
        level: "success",
        source: "GED",
        documentId,
        user,
        message: `Suggestions IA appliquées — ${user ?? "système"}${applied.length ? ` — ${applied.join(", ")}` : ""}${created.length ? ` · créés: ${created.join(", ")}` : ""}`,
      }).catch(() => {});

      // ── Apprentissage : mémorise un modèle de classement réutilisable (§6) ──
      try {
        let budgetMapping: TemplateBudgetMapping | null = null;
        const fis = await listFinancialItems({ documentId }).catch(() => []);
        const fi = fis[0];
        if (fi) budgetMapping = { type: getPrincipalType(fi), category: fi.categoryName, status: fi.status, amountSource: "total", dateSource: "document" };
        const template = await learnFromValidation({
          documentId,
          documentType: resolved.documentType?.name ?? overrides.documentTypeName ?? null,
          primaryCorrespondent: resolved.correspondent?.name ?? overrides.correspondentName ?? null,
          secondaryCorrespondents: [],
          tags: resolved.tags.map((t) => t.name),
          folder: resolved.folder?.name ?? overrides.folderName ?? null,
          budgetMapping,
          fingerprint: computeDocumentFingerprint(doc, doc.content ?? ""),
        });
        await appendGedLog({
          level: "info", source: "GED", documentId, user,
          message: `Modèle appris ${template.validatedCount > 1 ? "mis à jour" : "créé"} — ${template.label} (${template.validatedCount} validation${template.validatedCount > 1 ? "s" : ""})`,
        }).catch(() => {});
      } catch { /* l'apprentissage ne doit jamais bloquer la validation */ }

      return NextResponse.json({ ok: true, applied, created });
    }

    // ── Application sûre (champs vides uniquement) depuis la dernière analyse ──
    const analysis = await getLatestAnalysisForDocument(documentId);
    if (!analysis) {
      return NextResponse.json(
        { error: "no_analysis", message: "Aucune analyse IA à valider. Lancez d'abord une analyse." },
        { status: 404 },
      );
    }
    if ((analysis.warnings?.length ?? 0) > 0 || analysis.autoApplyEligible === false) {
      return NextResponse.json(
        { error: "needs_review", message: "Analyse à examiner — validez les suggestions depuis la Fiche IA." },
        { status: 422 },
      );
    }

    const patch: { correspondent?: number; document_type?: number; tags?: number[] } = {};
    const applied: string[] = [];
    const skipped: string[] = [];

    if (analysis.suggestedCorrespondentId != null) {
      if (doc.correspondent == null) { patch.correspondent = analysis.suggestedCorrespondentId; applied.push("correspondant"); }
      else skipped.push("correspondant");
    }
    if (analysis.suggestedDocumentTypeId != null) {
      if (doc.document_type == null) { patch.document_type = analysis.suggestedDocumentTypeId; applied.push("type"); }
      else skipped.push("type");
    }
    if (Array.isArray(analysis.suggestedTagIds) && analysis.suggestedTagIds.length > 0) {
      const toAdd = analysis.suggestedTagIds.filter((t) => !existingTags.includes(t));
      if (toAdd.length > 0) { patch.tags = [...existingTags, ...toAdd]; applied.push("tags"); }
    }

    if (Object.keys(patch).length > 0) await updateDocument(documentId, patch);
    await upsertAnalysis({ ...analysis, id: analysis.id, status: "applied" });

    await appendGedLog({
      level: applied.length > 0 ? "success" : "info",
      source: "GED",
      message: `Informations IA validées — ${user ?? "système"}${applied.length ? ` — ${applied.join(", ")}` : " — aucun champ vide à compléter"}`,
      documentId,
      user,
    }).catch(() => {});

    return NextResponse.json({ ok: true, applied, skipped });
  } catch (error) {
    return paperlessProxyError("Validation des informations IA impossible", error);
  }
}
