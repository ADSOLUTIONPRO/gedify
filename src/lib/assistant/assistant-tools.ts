import "server-only";

import { randomUUID } from "node:crypto";
import { readStore, STORE, type EngineDocument } from "@/lib/engine/stores";
import { searchIds, moreLikeIds } from "@/lib/engine/search";
import { listProjectFolders } from "@/lib/projects/project-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";
import { listReminders } from "@/lib/actions/reminder-store";
import type {
  DocumentRef,
  GedifyAssistantContext,
  ProposedAction,
  ProposedActionType,
} from "./assistant-types";
import { resolveContextDocumentIds } from "./assistant-context";

/* ────────────────────────────────────────────────────────────────────────
   Outils internes de l'assistant. Les outils de LECTURE sont exécutés
   immédiatement et renvoient des données RÉELLES de Gedify. Les outils
   « propose_* » n'exécutent rien : ils enregistrent une action à confirmer.
   ──────────────────────────────────────────────────────────────────────── */

const DOC_LIMIT = 20;

type Maps = {
  tags: Map<number, string>;
  types: Map<number, string>;
  correspondents: Map<number, string>;
};

async function loadMaps(): Promise<Maps> {
  const [tags, types, corr] = await Promise.all([
    readStore<{ id: number; name: string }[]>(STORE.tags, []),
    readStore<{ id: number; name: string }[]>(STORE.document_types, []),
    readStore<{ id: number; name: string }[]>(STORE.correspondents, []),
  ]);
  return {
    tags: new Map(tags.map((t) => [t.id, t.name])),
    types: new Map(types.map((t) => [t.id, t.name])),
    correspondents: new Map(corr.map((c) => [c.id, c.name])),
  };
}

async function liveDocs(): Promise<EngineDocument[]> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  return docs.filter((d) => !d.deleted);
}

function compact(d: EngineDocument, maps: Maps) {
  return {
    id: d.id,
    title: d.title,
    date: d.created?.slice(0, 10) ?? null,
    type: d.document_type != null ? maps.types.get(d.document_type) ?? null : null,
    correspondent: d.correspondent != null ? maps.correspondents.get(d.correspondent) ?? null : null,
    tags: d.tags.map((t) => maps.tags.get(t)).filter(Boolean),
  };
}

function pushRefs(refs: DocumentRef[], docs: EngineDocument[]) {
  for (const d of docs) if (!refs.some((r) => r.id === d.id)) refs.push({ id: d.id, title: d.title });
}

/* ── Schémas d'outils (format OpenAI tools / function calling) ───────────── */
export const TOOL_SCHEMAS = [
  fn("search_documents", "Recherche plein-texte dans les documents (titre + OCR).", {
    query: { type: "string", description: "Mots-clés ou expression à chercher." },
    limit: { type: "number", description: "Nombre max de résultats (défaut 20)." },
  }, ["query"]),
  fn("search_documents_by_status", "Documents selon un statut d'organisation.", {
    status: {
      type: "string",
      enum: ["untagged", "unclassified", "no_folder", "ai_review", "no_ai"],
      description:
        "untagged=sans tag ; unclassified=sans type ni tag ; no_folder=dans aucun dossier ; ai_review=analyse IA faible/à vérifier ; no_ai=jamais analysé.",
    },
  }, ["status"]),
  fn("search_documents_by_tag", "Documents portant un tag (par nom).", {
    tag: { type: "string", description: "Nom du tag." },
  }, ["tag"]),
  fn("search_documents_by_date_range", "Documents dont la date est dans un intervalle.", {
    from: { type: "string", description: "Date début YYYY-MM-DD." },
    to: { type: "string", description: "Date fin YYYY-MM-DD." },
  }, ["from", "to"]),
  fn("find_similar_documents", "Documents similaires à un document donné.", {
    documentId: { type: "number" },
  }, ["documentId"]),
  fn("get_document_ocr", "Texte OCR (extrait) d'un document.", {
    documentId: { type: "number" },
  }, ["documentId"]),
  fn("get_document_ai_summary", "Résumé et suggestions IA d'un document, s'ils existent.", {
    documentId: { type: "number" },
  }, ["documentId"]),
  fn("get_context_documents", "Documents ciblés par le contexte courant (sélection ou document actif).", {}, []),
  fn("list_folders", "Liste les dossiers/projets et le nombre de documents de chacun.", {}, []),
  fn("search_budget_entries", "Lignes du budget selon un filtre.", {
    filter: {
      type: "string",
      enum: ["to_pay", "overdue", "upcoming", "income", "all"],
      description: "to_pay=à payer ; overdue=en retard ; upcoming=à venir (30j) ; income=revenus ; all=tout.",
    },
  }, ["filter"]),
  fn("list_reminders", "Liste les rappels.", {
    status: { type: "string", enum: ["scheduled", "done"], description: "Statut (défaut scheduled)." },
  }, []),

  // ── Outils d'ACTION (proposent, n'exécutent pas) ──────────────────────────
  fn("propose_assign_folder", "Propose de classer des documents dans un dossier (par nom).", {
    documentIds: { type: "array", items: { type: "number" } },
    folderName: { type: "string", description: "Nom ou chemin du dossier cible (ex: « Maison / Électricité »)." },
  }, ["documentIds", "folderName"]),
  fn("propose_add_tags", "Propose d'ajouter des tags à des documents.", {
    documentIds: { type: "array", items: { type: "number" } },
    tags: { type: "array", items: { type: "string" } },
  }, ["documentIds", "tags"]),
  fn("propose_set_type", "Propose de définir le type de document.", {
    documentIds: { type: "array", items: { type: "number" } },
    type: { type: "string" },
  }, ["documentIds", "type"]),
  fn("propose_analyze", "Propose de lancer (ou relancer) l'analyse IA de documents.", {
    documentIds: { type: "array", items: { type: "number" } },
  }, ["documentIds"]),
  fn("propose_create_financial_item", "Propose de créer une ligne budget depuis un document.", {
    documentId: { type: "number" },
    kind: { type: "string", description: "expense | due_payment | debt | revenue | salary | tax | subscription | other" },
    amount: { type: "number" },
    label: { type: "string" },
    dueDate: { type: "string", description: "Échéance YYYY-MM-DD (optionnel)." },
  }, ["documentId", "kind", "amount", "label"]),
  fn("propose_create_reminder", "Propose de créer un rappel.", {
    title: { type: "string" },
    dueInDays: { type: "number", description: "Échéance dans N jours (alternative à dueDate)." },
    dueDate: { type: "string", description: "Échéance YYYY-MM-DD." },
    documentId: { type: "number", description: "Document lié (optionnel)." },
  }, ["title"]),
  fn("propose_draft_mail", "Propose un brouillon de mail (jamais envoyé sans confirmation).", {
    to: { type: "string", description: "Adresse destinataire si connue." },
    contactQuery: { type: "string", description: "Nom du contact/correspondant si l'adresse est inconnue." },
    subject: { type: "string" },
    body: { type: "string" },
    documentIds: { type: "array", items: { type: "number" }, description: "Pièces jointes (documents)." },
  }, ["subject", "body"]),
  fn("propose_navigate", "Propose d'ouvrir une page/élément (document, dossier, espace).", {
    target: { type: "string", enum: ["document", "folder", "finances", "mails", "reminders", "documents"] },
    id: { type: "string", description: "Identifiant de l'élément (id document, id dossier…)." },
  }, ["target"]),
] as const;

function fn(name: string, description: string, properties: Record<string, unknown>, required: string[]) {
  return {
    type: "function" as const,
    function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } },
  };
}

/* ── Dispatcher ──────────────────────────────────────────────────────────── */

export type ToolRunContext = {
  ctx: GedifyAssistantContext;
  proposals: ProposedAction[];
  refs: DocumentRef[];
};

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  rc: ToolRunContext,
): Promise<unknown> {
  switch (name) {
    case "search_documents":
      return searchDocumentsTool(String(args.query ?? ""), num(args.limit) ?? DOC_LIMIT, rc);
    case "search_documents_by_status":
      return statusTool(String(args.status ?? ""), rc);
    case "search_documents_by_tag":
      return tagTool(String(args.tag ?? ""), rc);
    case "search_documents_by_date_range":
      return dateRangeTool(String(args.from ?? ""), String(args.to ?? ""), rc);
    case "find_similar_documents":
      return similarTool(num(args.documentId) ?? 0, rc);
    case "get_document_ocr":
      return ocrTool(num(args.documentId) ?? 0);
    case "get_document_ai_summary":
      return aiSummaryTool(num(args.documentId) ?? 0);
    case "get_context_documents":
      return contextDocsTool(rc);
    case "list_folders":
      return foldersTool();
    case "search_budget_entries":
      return budgetTool(String(args.filter ?? "all"));
    case "list_reminders":
      return remindersTool(String(args.status ?? "scheduled"));

    case "propose_assign_folder":
      return propose("assign_folder", rc, idArray(args.documentIds), {
        folderName: String(args.folderName ?? ""),
      });
    case "propose_add_tags":
      return propose("add_tags", rc, idArray(args.documentIds), { tags: strArray(args.tags) });
    case "propose_set_type":
      return propose("set_type", rc, idArray(args.documentIds), { type: String(args.type ?? "") });
    case "propose_analyze":
      return propose("analyze", rc, idArray(args.documentIds), {});
    case "propose_create_financial_item":
      return propose("create_financial_item", rc, [num(args.documentId) ?? 0], {
        kind: String(args.kind ?? "expense"),
        amount: num(args.amount) ?? 0,
        label: String(args.label ?? ""),
        dueDate: args.dueDate ? String(args.dueDate) : null,
      });
    case "propose_create_reminder":
      return propose("create_reminder", rc, args.documentId != null ? [num(args.documentId) ?? 0] : [], {
        title: String(args.title ?? ""),
        dueInDays: num(args.dueInDays),
        dueDate: args.dueDate ? String(args.dueDate) : null,
        documentId: num(args.documentId),
      });
    case "propose_draft_mail":
      return propose("draft_mail", rc, idArray(args.documentIds), {
        to: args.to ? String(args.to) : null,
        contactQuery: args.contactQuery ? String(args.contactQuery) : null,
        subject: String(args.subject ?? ""),
        body: String(args.body ?? ""),
      });
    case "propose_navigate":
      return propose("navigate", rc, [], { target: String(args.target ?? "documents"), id: args.id != null ? String(args.id) : null });

    default:
      return { error: `Outil inconnu : ${name}` };
  }
}

/* ── Implémentations lecture ─────────────────────────────────────────────── */

async function searchDocumentsTool(query: string, limit: number, rc: ToolRunContext) {
  if (!query.trim()) return { count: 0, documents: [], note: "Requête vide." };
  const [hits, docs, maps] = await Promise.all([searchIds(query), liveDocs(), loadMaps()]);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const found = hits.map((h) => byId.get(h.id)).filter((d): d is EngineDocument => !!d).slice(0, limit);
  pushRefs(rc.refs, found);
  return { count: found.length, documents: found.map((d) => compact(d, maps)) };
}

async function statusTool(status: string, rc: ToolRunContext) {
  const [docs, maps, folders] = await Promise.all([liveDocs(), loadMaps(), listProjectFolders()]);
  let result: EngineDocument[] = [];
  if (status === "untagged") result = docs.filter((d) => d.tags.length === 0);
  else if (status === "unclassified") result = docs.filter((d) => d.document_type == null && d.tags.length === 0);
  else if (status === "no_folder") {
    const inFolder = new Set<number>();
    for (const f of folders) for (const id of f.linkedDocumentIds ?? []) inFolder.add(id);
    result = docs.filter((d) => !inFolder.has(d.id));
  } else if (status === "ai_review" || status === "no_ai") {
    const out: EngineDocument[] = [];
    for (const d of docs.slice(0, 300)) {
      const a = await getLatestAnalysisForDocument(d.id);
      if (status === "no_ai" && !a) out.push(d);
      if (status === "ai_review" && a && (a.confidence === "low" || a.needsReview === true)) out.push(d);
    }
    result = out;
  }
  const limited = result.slice(0, DOC_LIMIT);
  pushRefs(rc.refs, limited);
  return { count: result.length, shown: limited.length, documents: limited.map((d) => compact(d, maps)) };
}

async function tagTool(tag: string, rc: ToolRunContext) {
  const [docs, maps] = await Promise.all([liveDocs(), loadMaps()]);
  const tagId = [...maps.tags.entries()].find(([, n]) => n.toLowerCase() === tag.toLowerCase())?.[0];
  if (tagId == null) return { count: 0, documents: [], note: `Aucun tag nommé « ${tag} ».` };
  const result = docs.filter((d) => d.tags.includes(tagId)).slice(0, DOC_LIMIT);
  pushRefs(rc.refs, result);
  return { count: result.length, documents: result.map((d) => compact(d, maps)) };
}

async function dateRangeTool(from: string, to: string, rc: ToolRunContext) {
  const [docs, maps] = await Promise.all([liveDocs(), loadMaps()]);
  const result = docs
    .filter((d) => {
      const day = (d.created ?? "").slice(0, 10);
      return day && day >= from && day <= to;
    })
    .slice(0, DOC_LIMIT);
  pushRefs(rc.refs, result);
  return { count: result.length, documents: result.map((d) => compact(d, maps)) };
}

async function similarTool(documentId: number, rc: ToolRunContext) {
  const [docs, maps] = await Promise.all([liveDocs(), loadMaps()]);
  const base = docs.find((d) => d.id === documentId);
  if (!base) return { count: 0, documents: [], note: "Document introuvable." };
  const ids = await moreLikeIds(base.id, base.title, base.content ?? "");
  const byId = new Map(docs.map((d) => [d.id, d]));
  const result = ids.map((id) => byId.get(id)).filter((d): d is EngineDocument => !!d).slice(0, DOC_LIMIT);
  pushRefs(rc.refs, result);
  return { count: result.length, documents: result.map((d) => compact(d, maps)) };
}

async function ocrTool(documentId: number) {
  const docs = await liveDocs();
  const d = docs.find((x) => x.id === documentId);
  if (!d) return { error: "Document introuvable." };
  const text = (d.content ?? "").slice(0, 4000);
  return { documentId, title: d.title, ocr: text || "(aucun texte OCR)", truncated: (d.content ?? "").length > 4000 };
}

async function aiSummaryTool(documentId: number) {
  const a = await getLatestAnalysisForDocument(documentId);
  if (!a) return { documentId, analyzed: false, note: "Aucune analyse IA pour ce document." };
  return {
    documentId,
    analyzed: true,
    summary: a.summary ?? "",
    confidence: a.confidence ?? null,
    suggestedType: a.suggestedDocumentTypeName ?? null,
    suggestedCorrespondent: a.suggestedCorrespondentName ?? null,
    suggestedTags: a.suggestedTagNames ?? [],
    needsReview: a.needsReview ?? false,
  };
}

async function contextDocsTool(rc: ToolRunContext) {
  const ids = resolveContextDocumentIds(rc.ctx);
  if (ids.length === 0) return { count: 0, documents: [], note: "Aucun document actif ou sélectionné." };
  const [docs, maps] = await Promise.all([liveDocs(), loadMaps()]);
  const result = docs.filter((d) => ids.includes(d.id));
  pushRefs(rc.refs, result);
  return { count: result.length, documents: result.map((d) => compact(d, maps)) };
}

async function foldersTool() {
  const folders = await listProjectFolders();
  return {
    count: folders.length,
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      documentCount: (f.linkedDocumentIds ?? []).length,
    })),
  };
}

async function budgetTool(filter: string) {
  const items = await listFinancialItems({});
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const unpaidLike = (s: string) => !["paid", "cancelled", "ignored"].includes(s);

  let result = items;
  if (filter === "to_pay") result = items.filter((i) => i.direction === "outgoing" && unpaidLike(i.status));
  else if (filter === "overdue")
    result = items.filter((i) => i.direction === "outgoing" && unpaidLike(i.status) && i.dueDate != null && i.dueDate < today);
  else if (filter === "upcoming")
    result = items.filter((i) => i.direction === "outgoing" && unpaidLike(i.status) && i.dueDate != null && i.dueDate >= today && i.dueDate <= in30);
  else if (filter === "income") result = items.filter((i) => i.direction === "incoming");

  const shown = result.slice(0, 30);
  return {
    count: result.length,
    entries: shown.map((i) => ({
      id: i.id,
      label: i.label,
      amount: i.amount,
      kind: i.kind,
      direction: i.direction,
      status: i.status,
      dueDate: i.dueDate,
      documentId: i.sourceDocumentId,
    })),
  };
}

async function remindersTool(status: string) {
  const list = await listReminders({ status: status === "done" ? "done" : "scheduled" });
  return {
    count: list.length,
    reminders: list.slice(0, 30).map((r) => ({ id: r.id, title: r.title, remindAt: r.remindAt, status: r.status })),
  };
}

/* ── Construction d'une action proposée ──────────────────────────────────── */

const SENSITIVE_TYPES: ProposedActionType[] = ["assign_folder", "set_type", "create_financial_item", "draft_mail"];

function propose(
  type: ProposedActionType,
  rc: ToolRunContext,
  documentIds: number[],
  params: Record<string, unknown>,
) {
  const ids = documentIds.filter((n) => Number.isFinite(n) && n > 0);
  const clientSide = type === "navigate" || type === "draft_mail";
  const sensitive = SENSITIVE_TYPES.includes(type) || ids.length > 1;
  const requiresConfirmation = sensitive || ids.length > 1 || type !== "navigate";

  const action: ProposedAction = {
    id: randomUUID(),
    type,
    label: labelFor(type, ids.length, params),
    description: describeAction(type, ids.length, params),
    documentIds: ids,
    params,
    sensitive,
    requiresConfirmation: type === "navigate" ? false : requiresConfirmation,
    confidencePct: null,
    clientSide,
  };
  rc.proposals.push(action);
  return { proposed: true, actionId: action.id, summary: action.description };
}

function labelFor(type: ProposedActionType, n: number, p: Record<string, unknown>): string {
  switch (type) {
    case "assign_folder": return `Classer ${n} doc. dans « ${p.folderName} »`;
    case "add_tags": return `Ajouter tag(s) à ${n} doc.`;
    case "remove_tags": return `Retirer tag(s) de ${n} doc.`;
    case "set_type": return `Définir le type « ${p.type} »`;
    case "analyze": return `Analyser ${n} document(s)`;
    case "create_financial_item": return `Créer une ligne budget (${p.label})`;
    case "validate_financial_item": return `Valider une ligne budget`;
    case "create_reminder": return `Créer un rappel : ${p.title}`;
    case "draft_mail": return `Rédiger un mail : ${p.subject}`;
    case "navigate": return `Ouvrir ${p.target}`;
  }
}

function describeAction(type: ProposedActionType, n: number, p: Record<string, unknown>): string {
  switch (type) {
    case "assign_folder": return `Classer ${n} document(s) dans le dossier « ${p.folderName} ».`;
    case "add_tags": return `Ajouter le(s) tag(s) ${(p.tags as string[] | undefined)?.join(", ")} à ${n} document(s).`;
    case "remove_tags": return `Retirer des tags de ${n} document(s).`;
    case "set_type": return `Définir le type de document « ${p.type} » sur ${n} document(s).`;
    case "analyze": return `Lancer l'analyse IA de ${n} document(s).`;
    case "create_financial_item": return `Créer une ligne budget « ${p.label} » de ${p.amount} € depuis le document.`;
    case "validate_financial_item": return `Valider la ligne budget.`;
    case "create_reminder": return `Créer le rappel « ${p.title} »${p.dueDate ? ` pour le ${p.dueDate}` : p.dueInDays ? ` dans ${p.dueInDays} jours` : ""}.`;
    case "draft_mail": return `Préparer un brouillon de mail « ${p.subject} »${n > 0 ? ` avec ${n} pièce(s) jointe(s)` : ""}.`;
    case "navigate": return `Ouvrir ${p.target}${p.id ? ` ${p.id}` : ""}.`;
  }
}

/* ── Coercition d'arguments ──────────────────────────────────────────────── */
function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function idArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}
