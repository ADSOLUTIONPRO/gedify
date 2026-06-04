import "server-only";

import { randomUUID } from "node:crypto";
import { readStore, STORE, type EngineDocument } from "@/lib/engine/stores";
import { searchIds, moreLikeIds } from "@/lib/engine/search";
import { listProjectFolders } from "@/lib/projects/project-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";
import { listReminders } from "@/lib/actions/reminder-store";
import { listActions, getAction, type ListActionOptions } from "@/lib/actions/action-store";
import { listMailDocumentLinks } from "@/lib/messaging/mail-document-links-store";
import { listEmailLinks } from "@/lib/messaging/email-ged-link-store";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";
import { loadThreads } from "@/lib/messaging/load-threads";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { searchEmailMessages } from "@/lib/messaging/email-message-store";
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
      enum: ["untagged", "unclassified", "no_folder", "no_type", "no_correspondent", "ai_review", "no_ai", "no_ocr", "ocr_low"],
      description:
        "untagged=sans tag ; unclassified=sans type ni tag ; no_folder=dans aucun dossier ; no_type=sans type de document ; no_correspondent=sans correspondant ; ai_review=analyse IA faible/à vérifier ; no_ai=jamais analysé ; no_ocr=sans texte OCR ; ocr_low=OCR de faible qualité.",
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
  fn("find_documents_for_mail", "Documents GED liés à un mail/thread (pièces jointes importées + liens). Sans threadId, utilise le mail actif.", {
    threadId: { type: "string", description: "Identifiant du thread mail (optionnel si un mail est actif)." },
  }, []),
  fn("find_mail_for_document", "Retrouve le(s) mail(s) source(s) d'un document (thread + fichier joint).", {
    documentId: { type: "number" },
  }, ["documentId"]),
  fn("search_mails", "Recherche des mails : live si compte Gmail connecté (syntaxe Gmail, ex: from:edf has:attachment) ET mails dont une pièce jointe a été importée (tous comptes, dont IMAP).", {
    query: { type: "string", description: "Requête de recherche (défaut: boîte de réception)." },
    limit: { type: "number" },
  }, []),
  fn("list_contacts", "Recherche dans les contacts mail (par nom ou adresse).", {
    query: { type: "string", description: "Nom ou fragment d'adresse (optionnel)." },
  }, []),
  fn("list_tasks", "Liste les tâches/actions à faire.", {
    status: { type: "string", enum: ["open", "todo", "in-progress", "waiting", "overdue", "done"], description: "Filtre (défaut: open = à faire)." },
  }, []),
  fn("get_task", "Détail d'une tâche/action et ses documents liés. Sans taskId, utilise la tâche active.", {
    taskId: { type: "string", description: "Identifiant de la tâche (optionnel si une tâche est active)." },
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
  fn("propose_complete_task", "Propose de marquer une tâche/action comme terminée. Défaut: tâche active.", {
    taskId: { type: "string", description: "Identifiant de la tâche (optionnel si une tâche est active)." },
  }, []),
  fn("propose_apply_filter", "Filtre l'espace Documents et y navigue (comme si l'utilisateur appliquait le filtre lui-même).", {
    query: { type: "string", description: "Recherche plein-texte (optionnel)." },
    typeName: { type: "string", description: "Nom du type de document, ex: Facture." },
    tagName: { type: "string", description: "Nom du tag." },
    correspondentName: { type: "string", description: "Nom du correspondant." },
    etat: { type: "string", description: "État: a_traiter | classes | a_valider (optionnel)." },
  }, []),
  fn("propose_create_folder", "Crée un dossier (ou sous-dossier) dans Organiser.", {
    name: { type: "string" },
    parentName: { type: "string", description: "Dossier parent (optionnel)." },
  }, ["name"]),
  fn("propose_draft_mail", "Propose un brouillon de mail (jamais envoyé sans confirmation). Renseigner threadId pour répondre à un mail.", {
    to: { type: "string", description: "Adresse destinataire si connue." },
    contactQuery: { type: "string", description: "Nom du contact/correspondant si l'adresse est inconnue." },
    subject: { type: "string" },
    body: { type: "string" },
    documentIds: { type: "array", items: { type: "number" }, description: "Pièces jointes (documents)." },
    threadId: { type: "string", description: "Thread auquel répondre (réponse). Défaut: mail actif." },
    inReplyTo: { type: "string", description: "Identifiant du message auquel répondre (optionnel)." },
  }, ["subject", "body"]),
  fn("propose_navigate", "Propose d'ouvrir une page/élément (document, dossier, espace).", {
    target: { type: "string", enum: ["document", "folder", "finances", "mails", "reminders", "documents"] },
    id: { type: "string", description: "Identifiant de l'élément (id document, id dossier…)." },
  }, ["target"]),
  fn(
    "propose_pipeline",
    "Propose de relancer un traitement du pipeline documentaire en arrière-plan : OCR manquant, analyse IA des non classés, miniatures/aperçus manquants, réindexation, ou relance des jobs échoués. À confirmer.",
    {
      action: {
        type: "string",
        enum: [
          "ocr-missing",
          "ai-unclassified",
          "thumbnails-missing",
          "previews-missing",
          "reindex-all",
          "retry-failed",
        ],
        description:
          "ocr-missing = OCR des documents sans texte ; ai-unclassified = IA sur les non classés ; thumbnails-missing / previews-missing = générer les vignettes/aperçus manquants ; reindex-all = réindexer ; retry-failed = relancer les jobs échoués.",
      },
    },
    ["action"],
  ),
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
    case "find_documents_for_mail":
      return mailDocumentsTool(args.threadId ? String(args.threadId) : rc.ctx.activeMailId, rc);
    case "find_mail_for_document":
      return mailForDocumentTool(num(args.documentId) ?? 0);
    case "search_mails":
      return searchMailsTool(args.query ? String(args.query) : "in:inbox", num(args.limit) ?? 20);
    case "list_contacts":
      return contactsTool(args.query ? String(args.query) : "");
    case "list_tasks":
      return tasksTool(args.status ? String(args.status) : "open");
    case "get_task":
      return getTaskTool(args.taskId ? String(args.taskId) : rc.ctx.activeTaskId, rc);

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
    case "propose_complete_task":
      return propose("complete_task", rc, [], {
        taskId: args.taskId ? String(args.taskId) : rc.ctx.activeTaskId,
      });
    case "propose_apply_filter":
      return proposeApplyFilter(args, rc);
    case "propose_create_folder":
      return propose("create_folder", rc, [], {
        name: String(args.name ?? ""),
        parentName: args.parentName ? String(args.parentName) : null,
      });
    case "propose_draft_mail":
      return propose("draft_mail", rc, idArray(args.documentIds), {
        to: args.to ? String(args.to) : null,
        contactQuery: args.contactQuery ? String(args.contactQuery) : null,
        subject: String(args.subject ?? ""),
        body: String(args.body ?? ""),
        threadId: args.threadId ? String(args.threadId) : rc.ctx.activeMailId,
        inReplyTo: args.inReplyTo ? String(args.inReplyTo) : null,
      });
    case "propose_navigate":
      return propose("navigate", rc, [], { target: String(args.target ?? "documents"), id: args.id != null ? String(args.id) : null });
    case "propose_pipeline":
      return propose("pipeline", rc, [], { action: String(args.action ?? "") });

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
  } else if (status === "no_type") {
    result = docs.filter((d) => d.document_type == null);
  } else if (status === "no_correspondent") {
    result = docs.filter((d) => d.correspondent == null);
  } else if (status === "no_ocr") {
    result = docs.filter((d) => !(d.content ?? "").trim());
  } else if (status === "ocr_low") {
    result = docs.filter((d) => d.ocr_quality === "low" || (d.ocr_status === "failed"));
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

/* ── Mails / contacts ────────────────────────────────────────────────────── */

async function mailDocumentsTool(threadId: string | null, rc: ToolRunContext) {
  if (!threadId) return { count: 0, documents: [], note: "Aucun mail actif — précisez un threadId." };
  const [attLinks, gedLinks, docs, maps] = await Promise.all([
    listMailDocumentLinks({ threadId }),
    listEmailLinks({ emailId: threadId, targetKind: "document" }),
    liveDocs(),
    loadMaps(),
  ]);
  const ids = new Set<number>();
  for (const l of attLinks) if (l.paperlessDocumentId) ids.add(l.paperlessDocumentId);
  for (const l of gedLinks) if (l.target.kind === "document") ids.add(l.target.documentId);
  const found = docs.filter((d) => ids.has(d.id));
  pushRefs(rc.refs, found);
  return { threadId, count: found.length, documents: found.map((d) => compact(d, maps)) };
}

async function mailForDocumentTool(documentId: number) {
  if (!documentId) return { mails: [], note: "documentId manquant." };
  const [attLinks, gedLinks] = await Promise.all([
    listMailDocumentLinks(),
    listEmailLinks({ targetKind: "document" }),
  ]);
  const mails: { threadId: string; filename: string | null; source: string }[] = [];
  for (const l of attLinks) if (l.paperlessDocumentId === documentId) mails.push({ threadId: l.threadId, filename: l.filename, source: "pièce jointe" });
  for (const l of gedLinks) if (l.target.kind === "document" && l.target.documentId === documentId) mails.push({ threadId: l.emailId, filename: null, source: "lien manuel" });
  return { documentId, count: mails.length, mails: mails.slice(0, 20) };
}

async function searchMailsTool(query: string, limit: number) {
  const q = query.trim();
  const qLower = q.toLowerCase();
  const isDefault = !qLower || qLower === "in:inbox";

  // 1) Recherche LIVE Gmail (si un compte Gmail est connecté) — la plus riche.
  let gmail: { connected: boolean; account: string | null; threads: unknown[] } = {
    connected: false,
    account: null,
    threads: [],
  };
  try {
    const res = await loadThreads(q || "in:inbox", Math.min(limit, 40));
    if (res.connected) {
      gmail = {
        connected: true,
        account: res.accountEmail,
        threads: res.threads.slice(0, limit).map((t) => ({
          threadId: t.id,
          subject: t.subject,
          from: t.participants[0] ? (t.participants[0].name ?? t.participants[0].email) : null,
          snippet: t.snippet,
          date: t.lastMessageAt,
          unread: t.unread,
        })),
      };
    }
  } catch {
    /* Gmail indisponible : on garde la recherche locale ci-dessous. */
  }

  // 2) Recherche LOCALE provider-agnostique (Gmail + IMAP) : mails dont une
  //    pièce jointe a été importée dans la GED (mail-document-links).
  const links = await listMailDocumentLinks();
  const localHits = (isDefault
    ? links
    : links.filter(
        (l) =>
          (l.filename ?? "").toLowerCase().includes(qLower) ||
          (l.documentTitle ?? "").toLowerCase().includes(qLower) ||
          l.mailId.toLowerCase().includes(qLower),
      )
  ).slice(0, limit);

  // 3) Recherche plein-texte LOCALE (index alimenté par la synchro IMAP) :
  //    couvre TOUT le contenu des mails synchronisés, pas seulement les PJ.
  const mailboxHits = await searchEmailMessages(isDefault ? "" : qLower, limit);

  const accounts = await listAccounts().catch(() => []);
  const totalFound = gmail.threads.length + localHits.length + mailboxHits.length;

  return {
    accounts: accounts.map((a) => ({ provider: a.provider, email: a.email })),
    gmail,
    mailbox: {
      count: mailboxHits.length,
      mails: mailboxHits.map((m) => ({
        id: m.id,
        from: m.from,
        to: m.to,
        subject: m.subject,
        date: m.date,
        snippet: m.text.slice(0, 160),
        hasAttachments: m.hasAttachments,
      })),
    },
    localImported: {
      count: localHits.length,
      mails: localHits.map((l) => ({
        threadId: l.threadId,
        mailId: l.mailId,
        filename: l.filename,
        documentTitle: l.documentTitle,
        documentId: l.paperlessDocumentId,
        accountId: l.accountId,
      })),
    },
    note:
      totalFound === 0
        ? "Aucun mail trouvé. La recherche live nécessite un compte Gmail connecté ; pour l'IMAP, l'index plein-texte ne couvre que les mails déjà synchronisés."
        : undefined,
  };
}

async function contactsTool(query: string) {
  const contacts = await listEmailContacts();
  const q = query.trim().toLowerCase();
  const filtered = q
    ? contacts.filter(
        (c) =>
          (c.displayName ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.emails ?? []).some((e) => e.toLowerCase().includes(q)),
      )
    : contacts;
  return {
    count: filtered.length,
    contacts: filtered.slice(0, 25).map((c) => ({
      name: c.displayName,
      email: c.email ?? c.emails?.[0] ?? null,
      correspondentId: c.correspondentId,
    })),
  };
}

/* ── Tâches / actions ────────────────────────────────────────────────────── */

async function tasksTool(status: string) {
  const opt: ListActionOptions = {};
  if (status && status !== "all") opt.status = status as ListActionOptions["status"];
  const list = await listActions(opt);
  return {
    count: list.length,
    tasks: list.slice(0, 30).map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      priority: a.priority,
      dueDate: a.dueDate,
      documentIds: a.documentIds,
    })),
  };
}

async function getTaskTool(taskId: string | null, rc: ToolRunContext) {
  if (!taskId) return { found: false, note: "Aucune tâche active — précisez un taskId." };
  const task = await getAction(taskId);
  if (!task) return { found: false, note: "Tâche introuvable." };
  const [docs, maps] = await Promise.all([liveDocs(), loadMaps()]);
  const linked = docs.filter((d) => task.documentIds.includes(d.id));
  pushRefs(rc.refs, linked);
  return {
    found: true,
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    },
    documents: linked.map((d) => compact(d, maps)),
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

/** Construit une action « filtrer Documents » : résout les noms→ids et l'URL. */
async function proposeApplyFilter(args: Record<string, unknown>, rc: ToolRunContext) {
  const maps = await loadMaps();
  const params = new URLSearchParams();
  const query = args.query ? String(args.query).trim() : "";
  if (query) params.set("query", query);

  const findId = (m: Map<number, string>, name: string) =>
    [...m.entries()].find(([, n]) => n.toLowerCase() === name.toLowerCase())?.[0];

  const typeName = args.typeName ? String(args.typeName).trim() : "";
  if (typeName) {
    const id = findId(maps.types, typeName);
    if (id != null) params.set("document_type", String(id));
    else if (!query) params.set("query", typeName);
  }
  const tagName = args.tagName ? String(args.tagName).trim() : "";
  if (tagName) {
    const id = findId(maps.tags, tagName);
    if (id != null) params.set("tag", String(id));
  }
  const corrName = args.correspondentName ? String(args.correspondentName).trim() : "";
  if (corrName) {
    const id = findId(maps.correspondents, corrName);
    if (id != null) params.set("correspondent", String(id));
  }
  if (args.etat) params.set("etat", String(args.etat));
  params.set("view", "grid");

  const url = `/documents?${params.toString()}`;
  const labelParts = [query, typeName, tagName, corrName].filter(Boolean).join(", ") || "tous";
  const action: ProposedAction = {
    id: randomUUID(),
    type: "apply_filter",
    label: `Filtrer : ${labelParts}`,
    description: `Appliquer le filtre dans l'espace Documents (${labelParts}).`,
    documentIds: [],
    params: { url },
    sensitive: false,
    requiresConfirmation: false,
    confidencePct: null,
    clientSide: true,
  };
  rc.proposals.push(action);
  return { proposed: true, actionId: action.id, url, summary: action.description };
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
    case "complete_task": return "Marquer la tâche terminée";
    case "create_folder": return `Créer le dossier « ${p.name} »`;
    case "apply_filter": return "Filtrer les documents";
    case "draft_mail": return `Rédiger un mail : ${p.subject}`;
    case "navigate": return `Ouvrir ${p.target}`;
    case "pipeline": return pipelineLabel(String(p.action ?? ""));
  }
}

const PIPELINE_LABELS: Record<string, string> = {
  "ocr-missing": "Relancer l'OCR manquant",
  "ai-unclassified": "Analyser les non classés (IA)",
  "thumbnails-missing": "Générer les miniatures manquantes",
  "previews-missing": "Générer les aperçus manquants",
  "reindex-all": "Réindexer tous les documents",
  "retry-failed": "Relancer les jobs échoués",
};
function pipelineLabel(action: string): string {
  return PIPELINE_LABELS[action] ?? `Retraitement pipeline (${action})`;
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
    case "complete_task": return "Marquer la tâche/action comme terminée.";
    case "create_folder": return `Créer le dossier « ${p.name} »${p.parentName ? ` dans « ${p.parentName} »` : ""}.`;
    case "apply_filter": return "Appliquer le filtre dans l'espace Documents.";
    case "draft_mail": return `Préparer un brouillon de mail « ${p.subject} »${n > 0 ? ` avec ${n} pièce(s) jointe(s)` : ""}.`;
    case "navigate": return `Ouvrir ${p.target}${p.id ? ` ${p.id}` : ""}.`;
    case "pipeline": return `${pipelineLabel(String(p.action ?? ""))} (traitement en arrière-plan).`;
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
