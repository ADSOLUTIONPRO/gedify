import "server-only";

import {
  mutateList,
  nextId,
  readStore,
  slugify,
  STORE,
  type EngineDocument,
  type EngineNamed,
  type EngineTag,
} from "@/lib/engine/stores";
import { indexDocument } from "@/lib/engine/search";
import { loadNameMaps } from "@/lib/engine/helpers";
import { resolveFolderPath, linkProjectDocuments } from "@/lib/projects/project-store";
import { listGedWorkflows, appendGedLog } from "@/lib/ged/ged-store";
import type { GedWorkflow, GedWorkflowCondition, GedWorkflowAction } from "@/lib/ged/ged-types";

/* ────────────────────────────────────────────────────────────────────────
   Moteur d'exécution des workflows / règles automatiques (Chantier workflows).

   Une règle = conditions (ET) sur un document + actions à appliquer. Évalue
   contre le contenu OCR / titre / correspondant / type / tags / nom de fichier,
   et applique : ajout de tag, correspondant, type, déplacement vers un dossier.
   Idempotent (ne re-tague pas, ne re-déplace pas). Tout est best-effort et
   journalisé (logs GED) si la règle l'active.

   Vocabulaire (aligné avec l'éditeur de règles) :
     champs    : title | content | filename | correspondent | document_type | tag | any
     opérateurs: contains | not_contains | equals | starts_with | regex
     actions   : add_tag | set_correspondent | set_document_type | move_to_folder
   ──────────────────────────────────────────────────────────────────────── */

export const WORKFLOW_FIELDS = [
  "any",
  "title",
  "content",
  "filename",
  "correspondent",
  "document_type",
  "tag",
] as const;
export const WORKFLOW_OPERATORS = [
  "contains",
  "not_contains",
  "equals",
  "starts_with",
  "regex",
] as const;
export const WORKFLOW_ACTIONS = [
  "add_tag",
  "set_correspondent",
  "set_document_type",
  "move_to_folder",
  "create_task",
] as const;

type EvalContext = {
  title: string;
  content: string;
  filename: string;
  correspondent: string;
  documentType: string;
  tags: string[];
};

function buildContext(
  doc: EngineDocument,
  maps: { correspondents: Map<number, string>; document_types: Map<number, string>; tags: Map<number, string> },
): EvalContext {
  return {
    title: (doc.title ?? "").toLowerCase(),
    content: (doc.content ?? "").toLowerCase(),
    filename: (doc.original_file_name ?? "").toLowerCase(),
    correspondent: (doc.correspondent != null ? maps.correspondents.get(doc.correspondent) ?? "" : "").toLowerCase(),
    documentType: (doc.document_type != null ? maps.document_types.get(doc.document_type) ?? "" : "").toLowerCase(),
    tags: (doc.tags ?? []).map((t) => (maps.tags.get(t) ?? "").toLowerCase()),
  };
}

function testOperator(haystack: string, operator: string, value: string): boolean {
  const v = value.toLowerCase().trim();
  if (!v && operator !== "regex") return false;
  switch (operator) {
    case "contains":
      return haystack.includes(v);
    case "not_contains":
      return !haystack.includes(v);
    case "equals":
      return haystack.trim() === v;
    case "starts_with":
      return haystack.trim().startsWith(v);
    case "regex":
      try {
        return new RegExp(value, "i").test(haystack);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function conditionMatches(cond: GedWorkflowCondition, ctx: EvalContext): boolean {
  const field = cond.field;
  if (field === "tag") {
    // « not_contains » sur les tags = aucun tag ne contient la valeur.
    if (cond.operator === "not_contains") {
      return !ctx.tags.some((t) => t.includes(cond.value.toLowerCase().trim()));
    }
    return ctx.tags.some((t) => testOperator(t, cond.operator, cond.value));
  }
  const haystack =
    field === "title" ? ctx.title
    : field === "content" ? ctx.content
    : field === "filename" ? ctx.filename
    : field === "correspondent" ? ctx.correspondent
    : field === "document_type" ? ctx.documentType
    : `${ctx.title} ${ctx.content} ${ctx.filename}`; // any
  return testOperator(haystack, cond.operator, cond.value);
}

/** Toutes les conditions doivent passer (ET). Sans condition → ne matche jamais. */
export function workflowMatches(wf: GedWorkflow, ctx: EvalContext): boolean {
  if (!wf.conditions || wf.conditions.length === 0) return false;
  return wf.conditions.every((c) => conditionMatches(c, ctx));
}

function randomColor(): string {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 65%, 55%)`;
}

async function findOrCreateTag(name: string): Promise<number> {
  const norm = name.trim();
  const list = await readStore<EngineTag[]>(STORE.tags, []);
  const found = list.find((t) => (t.name ?? "").toLowerCase() === norm.toLowerCase());
  if (found) return found.id;
  const id = await nextId("tags");
  const record: EngineTag = {
    id,
    name: norm,
    slug: slugify(norm),
    color: randomColor(),
    text_color: "#ffffff",
    match: "",
    matching_algorithm: 0,
    is_insensitive: true,
    is_inbox_tag: false,
    owner: 1,
  };
  await mutateList<EngineTag>(STORE.tags, (l) => [...l, record]);
  return id;
}

async function findOrCreateNamed(store: string, seq: string, name: string): Promise<number> {
  const norm = name.trim();
  const list = await readStore<EngineNamed[]>(store, []);
  const found = list.find((x) => (x.name ?? "").toLowerCase() === norm.toLowerCase());
  if (found) return found.id;
  const id = await nextId(seq);
  const record: EngineNamed = {
    id,
    name: norm,
    slug: slugify(norm),
    match: "",
    matching_algorithm: 0,
    is_insensitive: true,
    owner: 1,
  };
  await mutateList<EngineNamed>(store, (l) => [...l, record]);
  return id;
}

export type WorkflowActionResult = { type: string; value: string; ok: boolean; detail: string };

/** Applique les actions d'une règle à un document. dryRun = aucune écriture. */
async function applyActions(
  doc: EngineDocument,
  actions: GedWorkflowAction[],
  dryRun: boolean,
): Promise<{ results: WorkflowActionResult[]; changed: EngineDocument }> {
  const results: WorkflowActionResult[] = [];
  const tags = [...(doc.tags ?? [])];
  let correspondent = doc.correspondent;
  let documentType = doc.document_type;

  for (const action of actions) {
    const value = (action.value ?? "").trim();
    try {
      if (action.type === "add_tag") {
        if (!value) { results.push({ type: action.type, value, ok: false, detail: "valeur vide" }); continue; }
        if (dryRun) {
          results.push({ type: action.type, value, ok: true, detail: `ajouterait le tag « ${value} »` });
        } else {
          const id = await findOrCreateTag(value);
          if (!tags.includes(id)) tags.push(id);
          results.push({ type: action.type, value, ok: true, detail: `tag « ${value} » ajouté` });
        }
      } else if (action.type === "set_correspondent") {
        if (!value) { results.push({ type: action.type, value, ok: false, detail: "valeur vide" }); continue; }
        if (dryRun) {
          results.push({ type: action.type, value, ok: true, detail: `définirait le correspondant « ${value} »` });
        } else {
          correspondent = await findOrCreateNamed(STORE.correspondents, "correspondents", value);
          results.push({ type: action.type, value, ok: true, detail: `correspondant « ${value} »` });
        }
      } else if (action.type === "set_document_type") {
        if (!value) { results.push({ type: action.type, value, ok: false, detail: "valeur vide" }); continue; }
        if (dryRun) {
          results.push({ type: action.type, value, ok: true, detail: `définirait le type « ${value} »` });
        } else {
          documentType = await findOrCreateNamed(STORE.document_types, "document_types", value);
          results.push({ type: action.type, value, ok: true, detail: `type « ${value} »` });
        }
      } else if (action.type === "move_to_folder") {
        if (!value) { results.push({ type: action.type, value, ok: false, detail: "chemin vide" }); continue; }
        if (dryRun) {
          results.push({ type: action.type, value, ok: true, detail: `classerait dans « ${value} »` });
        } else {
          const folder = await resolveFolderPath(value);
          if (folder) {
            await linkProjectDocuments(folder.id, [doc.id]);
            results.push({ type: action.type, value, ok: true, detail: `classé dans « ${value} »` });
          } else {
            results.push({ type: action.type, value, ok: false, detail: "dossier non résolu" });
          }
        }
      } else if (action.type === "create_task") {
        // value = « [+Nj] Intitulé » → tâche/rappel liée au document, échéance optionnelle.
        if (!value) { results.push({ type: action.type, value, ok: false, detail: "intitulé vide" }); continue; }
        const m = value.match(/^\+(\d+)\s*j\s+(.*)$/i);
        const dueDate = m ? new Date(Date.now() + Number(m[1]) * 86_400_000).toISOString() : null;
        const taskTitle = m ? m[2].trim() : value;
        if (dryRun) {
          results.push({ type: action.type, value, ok: true, detail: `créerait la tâche « ${taskTitle} »${dueDate ? ` (échéance ${dueDate.slice(0, 10)})` : ""}` });
        } else {
          const { createAction } = await import("@/lib/actions/action-store");
          await createAction({ title: taskTitle, documentIds: [doc.id], dueDate });
          results.push({ type: action.type, value, ok: true, detail: `tâche « ${taskTitle} » créée` });
        }
      } else {
        results.push({ type: action.type, value, ok: false, detail: "action inconnue" });
      }
    } catch (e) {
      results.push({ type: action.type, value, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  const changed: EngineDocument = {
    ...doc,
    tags,
    correspondent,
    document_type: documentType,
    modified: new Date().toISOString(),
  };
  return { results, changed };
}

export type WorkflowDocResult = {
  workflowId: string;
  workflowName: string;
  matched: boolean;
  actions: WorkflowActionResult[];
};

/** Exécute UNE règle sur UN document (dry-run possible). Persiste si modifié. */
export async function applyWorkflowToDocument(
  wf: GedWorkflow,
  docId: number,
  options: { dryRun?: boolean } = {},
): Promise<WorkflowDocResult> {
  const dryRun = options.dryRun ?? false;
  const maps = await loadNameMaps();
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  const doc = docs.find((d) => d.id === docId && !d.deleted);
  if (!doc) return { workflowId: wf.id, workflowName: wf.name, matched: false, actions: [] };

  const ctx = buildContext(doc, maps);
  if (!workflowMatches(wf, ctx)) {
    return { workflowId: wf.id, workflowName: wf.name, matched: false, actions: [] };
  }

  const { results, changed } = await applyActions(doc, wf.actions ?? [], dryRun);

  if (!dryRun) {
    await mutateList<EngineDocument>(STORE.documents, (list) =>
      list.map((d) => (d.id === docId ? changed : d)),
    );
    await indexDocument(changed, maps.correspondents, maps.document_types, maps.tags).catch(() => {});
    if (wf.logging) {
      await appendGedLog({
        level: "success",
        source: "Workflow",
        message: `Règle « ${wf.name} » appliquée au document #${docId}`,
        details: results.map((r) => r.detail).join(" · "),
        documentId: docId,
      }).catch(() => {});
    }
  }

  return { workflowId: wf.id, workflowName: wf.name, matched: true, actions: results };
}

/** Déclencheurs considérés « à l'arrivée d'un document » (tout sauf manuel/planifié). */
function isOnAddTrigger(trigger: string): boolean {
  const t = (trigger ?? "").toLowerCase();
  if (t === "manual" || t === "scheduled" || t === "manuel") return false;
  return (
    t === "" ||
    t === "any" ||
    t === "added" ||
    t === "consumption" ||
    t.includes("import") ||
    t.includes("add") ||
    t.includes("document")
  );
}

/**
 * Exécute TOUTES les règles actives (triées par priorité croissante) sur un
 * document nouvellement arrivé. Best-effort, ne lève jamais.
 */
export async function runWorkflowsForDocument(docId: number): Promise<WorkflowDocResult[]> {
  try {
    const workflows = (await listGedWorkflows())
      .filter((w) => w.enabled && isOnAddTrigger(w.trigger))
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const out: WorkflowDocResult[] = [];
    for (const wf of workflows) {
      out.push(await applyWorkflowToDocument(wf, docId, { dryRun: false }));
    }
    return out;
  } catch (e) {
    console.error("[workflow] exécution à l'import échouée :", e instanceof Error ? e.message : e);
    return [];
  }
}

export type WorkflowBatchResult = {
  matched: number;
  applied: number;
  sample: { id: number; title: string; actions: WorkflowActionResult[] }[];
};

/**
 * Exécute UNE règle sur TOUS les documents actifs (dry-run = simulation).
 * Renvoie le nombre de documents concernés + un échantillon.
 */
export async function runWorkflowOverAll(
  wf: GedWorkflow,
  options: { dryRun?: boolean } = {},
): Promise<WorkflowBatchResult> {
  const dryRun = options.dryRun ?? false;
  const maps = await loadNameMaps();
  const docs = (await readStore<EngineDocument[]>(STORE.documents, [])).filter((d) => !d.deleted);

  let matched = 0;
  let applied = 0;
  const sample: WorkflowBatchResult["sample"] = [];

  for (const doc of docs) {
    const ctx = buildContext(doc, maps);
    if (!workflowMatches(wf, ctx)) continue;
    matched += 1;
    const res = await applyWorkflowToDocument(wf, doc.id, { dryRun });
    if (!dryRun && res.matched) applied += 1;
    if (sample.length < 10) sample.push({ id: doc.id, title: doc.title, actions: res.actions });
  }

  return { matched, applied, sample };
}
