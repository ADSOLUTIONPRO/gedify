import "server-only";

import { readStore, STORE, type EngineDocument } from "@/lib/engine/stores";
import type { GedifyAssistantContext } from "./assistant-types";

/**
 * Documents « cibles » déduits du contexte courant pour les demandes courtes
 * (« classe ce document », « analyse la sélection ») : priorité à la sélection,
 * puis au document actif, puis au dernier document ouvert.
 */
export function resolveContextDocumentIds(ctx: GedifyAssistantContext): number[] {
  if (ctx.selectedDocumentIds && ctx.selectedDocumentIds.length > 0) {
    return [...new Set(ctx.selectedDocumentIds)];
  }
  if (ctx.activeDocumentId != null) return [ctx.activeDocumentId];
  if (ctx.lastOpenedDocumentId != null) return [ctx.lastOpenedDocumentId];
  return [];
}

/**
 * Résumé textuel concis du contexte applicatif, injecté dans le prompt système.
 * On expanse les titres de documents (utile au modèle) sans envoyer l'OCR.
 */
export async function describeContext(ctx: GedifyAssistantContext): Promise<string> {
  const lines: string[] = [];
  lines.push(`- Espace : ${ctx.currentSpace} (route ${ctx.currentRoute})`);
  if (ctx.currentView) lines.push(`- Vue : ${ctx.currentView}`);

  const needDocs = ctx.activeDocumentId != null || ctx.selectedDocumentIds.length > 0;
  const docs = needDocs ? await readStore<EngineDocument[]>(STORE.documents, []) : [];
  const titleOf = (id: number) => docs.find((d) => d.id === id)?.title ?? `Document ${id}`;

  if (ctx.activeDocumentId != null) {
    lines.push(`- Document actif : #${ctx.activeDocumentId} « ${titleOf(ctx.activeDocumentId)} »`);
  }
  if (ctx.selectedDocumentIds.length > 0) {
    const sample = ctx.selectedDocumentIds.slice(0, 8).map((id) => `#${id}`).join(", ");
    lines.push(
      `- Documents sélectionnés : ${ctx.selectedDocumentIds.length} (${sample}${ctx.selectedDocumentIds.length > 8 ? "…" : ""})`,
    );
  }
  if (ctx.activeFolderId) lines.push(`- Dossier actif : ${ctx.activeFolderId}`);
  if (ctx.activeMailId) lines.push(`- Mail actif : ${ctx.activeMailId}`);
  if (ctx.activeContactId) lines.push(`- Contact actif : ${ctx.activeContactId}`);
  if (ctx.activeBudgetEntryId) lines.push(`- Ligne budget active : ${ctx.activeBudgetEntryId}`);
  if (ctx.activeTaskId) lines.push(`- Tâche active : ${ctx.activeTaskId}`);
  if (ctx.activeSearchQuery) lines.push(`- Recherche en cours : « ${ctx.activeSearchQuery} »`);
  const filters = Object.entries(ctx.activeFilters ?? {}).filter(([, v]) => v);
  if (filters.length) lines.push(`- Filtres actifs : ${filters.map(([k, v]) => `${k}=${v}`).join(", ")}`);

  return lines.join("\n");
}
