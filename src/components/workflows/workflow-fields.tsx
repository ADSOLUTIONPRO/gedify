"use client";

import { X } from "lucide-react";
import { TaxonomyAutocompleteInput } from "@/components/forms/taxonomy-autocomplete-input";
import type { TaxonomyKind } from "@/lib/taxonomies/taxonomy-kinds";

/* Constantes + éditeur de conditions/actions partagés par la page Workflows
   refondue (réutilise l'autocomplétion des taxonomies + le modèle réel). */

export type WorkflowCondition = { field: string; operator: string; value: string };
export type WorkflowAction = { type: string; value: string };
export type Workflow = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: string;
  priority: number;
  logging: boolean;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  runCount: number;
  lastRunAt: string | null;
};

export const FIELDS = [
  { value: "any", label: "N'importe où (titre + OCR + fichier)" },
  { value: "title", label: "Titre" },
  { value: "content", label: "Texte OCR" },
  { value: "filename", label: "Nom de fichier" },
  { value: "correspondent", label: "Correspondant" },
  { value: "document_type", label: "Type de document" },
  { value: "tag", label: "Tag" },
];
export const OPERATORS = [
  { value: "contains", label: "contient" },
  { value: "not_contains", label: "ne contient pas" },
  { value: "equals", label: "égal à" },
  { value: "starts_with", label: "commence par" },
  { value: "regex", label: "regex" },
];
export const ACTIONS = [
  { value: "add_tag", label: "Ajouter le tag", placeholder: "ex. Énergie" },
  { value: "set_correspondent", label: "Définir le correspondant", placeholder: "ex. EDF" },
  { value: "set_document_type", label: "Définir le type", placeholder: "ex. Facture" },
  { value: "move_to_folder", label: "Classer dans le dossier", placeholder: "ex. Maison/Électricité" },
  { value: "create_task", label: "Créer une tâche / rappel", placeholder: "ex. +30j Relancer le paiement" },
];
export const TRIGGERS = [
  { value: "document-imported", label: "Document importé" },
  { value: "document-updated", label: "Document modifié" },
  { value: "ocr-done", label: "OCR terminé" },
  { value: "ai-done", label: "Analyse IA terminée" },
  { value: "document-validated", label: "Document validé" },
  { value: "email-imported", label: "Email importé" },
  { value: "attachment-imported", label: "Pièce jointe importée" },
  { value: "added-to-folder", label: "Ajouté à un dossier" },
  { value: "manual", label: "Action manuelle" },
  { value: "scheduled", label: "Planification" },
];

export const triggerLabel = (v: string) => TRIGGERS.find((t) => t.value === v)?.label ?? v;
export const fieldLabel = (v: string) => FIELDS.find((f) => f.value === v)?.label ?? v;
export const opLabel = (v: string) => OPERATORS.find((o) => o.value === v)?.label ?? v;
export const actionLabel = (v: string) => ACTIONS.find((a) => a.value === v)?.label ?? v;

export const blankCondition = (): WorkflowCondition => ({ field: "content", operator: "contains", value: "" });
export const blankAction = (): WorkflowAction => ({ type: "add_tag", value: "" });

function fieldKind(field: string): TaxonomyKind | null {
  if (field === "tag") return "tag";
  if (field === "correspondent") return "correspondent";
  if (field === "document_type") return "document_type";
  return null;
}
function actionKind(type: string): TaxonomyKind | null {
  if (type === "add_tag") return "tag";
  if (type === "set_correspondent") return "correspondent";
  if (type === "set_document_type") return "document_type";
  if (type === "move_to_folder") return "folder";
  return null;
}

const inputCls = "h-9 rounded-lg border px-2.5 text-[13px] outline-none transition focus:border-[var(--accent)]";

export function ConditionsEditor({ conditions, setConditions }: { conditions: WorkflowCondition[]; setConditions: React.Dispatch<React.SetStateAction<WorkflowCondition[]>> }) {
  return (
    <div className="flex flex-col gap-2">
      {conditions.map((c, i) => {
        const ck = fieldKind(c.field);
        const setVal = (v: string) => setConditions((cs) => cs.map((x, j) => (j === i ? { ...x, value: v } : x)));
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select value={c.field} onChange={(e) => setConditions((cs) => cs.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} className={inputCls} style={{ borderColor: "var(--border)" }}>
              {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={c.operator} onChange={(e) => setConditions((cs) => cs.map((x, j) => (j === i ? { ...x, operator: e.target.value } : x)))} className={inputCls} style={{ borderColor: "var(--border)" }}>
              {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {ck ? (
              <div className="min-w-32 flex-1"><TaxonomyAutocompleteInput kind={ck} value={c.value} onChange={setVal} className={`${inputCls} w-full`} placeholder="valeur (autocomplétée)" /></div>
            ) : (
              <input value={c.value} onChange={(e) => setVal(e.target.value)} placeholder="valeur" className={`${inputCls} min-w-32 flex-1`} style={{ borderColor: "var(--border)" }} />
            )}
            <button type="button" onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))} aria-label="Retirer la condition" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
      <button type="button" onClick={() => setConditions((cs) => [...cs, blankCondition()])} className="self-start text-[12px] font-semibold" style={{ color: "var(--accent)" }}>+ condition</button>
    </div>
  );
}

export function ActionsEditor({ actions, setActions }: { actions: WorkflowAction[]; setActions: React.Dispatch<React.SetStateAction<WorkflowAction[]>> }) {
  return (
    <div className="flex flex-col gap-2">
      {actions.map((a, i) => {
        const meta = ACTIONS.find((x) => x.value === a.type);
        const ak = actionKind(a.type);
        const setVal = (v: string) => setActions((as) => as.map((x, j) => (j === i ? { ...x, value: v } : x)));
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select value={a.type} onChange={(e) => setActions((as) => as.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} className={inputCls} style={{ borderColor: "var(--border)" }}>
              {ACTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
            {ak ? (
              <div className="min-w-32 flex-1"><TaxonomyAutocompleteInput kind={ak} value={a.value} onChange={setVal} className={`${inputCls} w-full`} placeholder={meta?.placeholder ?? "valeur"} /></div>
            ) : (
              <input value={a.value} onChange={(e) => setVal(e.target.value)} placeholder={meta?.placeholder ?? "valeur"} className={`${inputCls} min-w-32 flex-1`} style={{ borderColor: "var(--border)" }} />
            )}
            <button type="button" onClick={() => setActions((as) => as.filter((_, j) => j !== i))} aria-label="Retirer l'action" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
      <button type="button" onClick={() => setActions((as) => [...as, blankAction()])} className="self-start text-[12px] font-semibold" style={{ color: "var(--accent)" }}>+ action</button>
    </div>
  );
}
