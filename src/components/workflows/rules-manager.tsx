"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  FlaskConical,
  Loader2,
  Pencil,
  Play,
  Plus,
  Power,
  Save,
  Trash2,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import { TaxonomyAutocompleteInput } from "@/components/forms/taxonomy-autocomplete-input";
import type { TaxonomyKind } from "@/lib/taxonomies/taxonomy-kinds";

type Condition = { field: string; operator: string; value: string };
type Action = { type: string; value: string };
type Workflow = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  priority: number;
  conditions: Condition[];
  actions: Action[];
  runCount: number;
  lastRunAt: string | null;
};

const FIELDS: { value: string; label: string }[] = [
  { value: "any", label: "N'importe où (titre + OCR + fichier)" },
  { value: "title", label: "Titre" },
  { value: "content", label: "Texte OCR" },
  { value: "filename", label: "Nom de fichier" },
  { value: "correspondent", label: "Correspondant" },
  { value: "document_type", label: "Type de document" },
  { value: "tag", label: "Tag" },
];
const OPERATORS: { value: string; label: string }[] = [
  { value: "contains", label: "contient" },
  { value: "not_contains", label: "ne contient pas" },
  { value: "equals", label: "égal à" },
  { value: "starts_with", label: "commence par" },
  { value: "regex", label: "regex" },
];
const ACTIONS: { value: string; label: string; placeholder: string }[] = [
  { value: "add_tag", label: "Ajouter le tag", placeholder: "ex. Énergie" },
  { value: "set_correspondent", label: "Définir le correspondant", placeholder: "ex. EDF" },
  { value: "set_document_type", label: "Définir le type", placeholder: "ex. Facture" },
  { value: "move_to_folder", label: "Classer dans le dossier", placeholder: "ex. Maison/Électricité" },
  { value: "create_task", label: "Créer une tâche / rappel", placeholder: "ex. +30j Relancer le paiement" },
];

const fieldLabel = (v: string) => FIELDS.find((f) => f.value === v)?.label ?? v;
const opLabel = (v: string) => OPERATORS.find((o) => o.value === v)?.label ?? v;
const actionLabel = (v: string) => ACTIONS.find((a) => a.value === v)?.label ?? v;
const input = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

const blankCondition = (): Condition => ({ field: "content", operator: "contains", value: "" });
const blankAction = (): Action => ({ type: "add_tag", value: "" });

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

/* ── Champs d'une règle (nom + conditions + actions) — création ET édition ── */
function RuleFields({
  name, setName, conditions, setConditions, actions, setActions,
}: {
  name: string;
  setName: (v: string) => void;
  conditions: Condition[];
  setConditions: React.Dispatch<React.SetStateAction<Condition[]>>;
  actions: Action[];
  setActions: React.Dispatch<React.SetStateAction<Action[]>>;
}) {
  return (
    <div className="space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la règle (ex. Factures EDF → Énergie)" className={`${input} w-full`} />

      {/* Conditions — carte bleue */}
      <div className="rounded-xl border p-3" style={{ borderColor: "var(--gedify-info)", background: "var(--gedify-info-soft)" }}>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Si (toutes les conditions)</p>
        <div className="flex flex-col gap-2">
          {conditions.map((c, i) => {
            const ck = fieldKind(c.field);
            const setVal = (v: string) => setConditions((cs) => cs.map((x, j) => (j === i ? { ...x, value: v } : x)));
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select value={c.field} onChange={(e) => setConditions((cs) => cs.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} className={input}>
                  {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={c.operator} onChange={(e) => setConditions((cs) => cs.map((x, j) => (j === i ? { ...x, operator: e.target.value } : x)))} className={input}>
                  {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {ck ? (
                  <div className="min-w-32 flex-1">
                    <TaxonomyAutocompleteInput kind={ck} value={c.value} onChange={setVal} className={`${input} w-full`} placeholder="valeur (autocomplétée)" />
                  </div>
                ) : (
                  <input value={c.value} onChange={(e) => setVal(e.target.value)} placeholder="valeur" className={`${input} flex-1 min-w-32`} />
                )}
                <button type="button" onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="h-4 w-4" /></button>
              </div>
            );
          })}
          <button type="button" onClick={() => setConditions((cs) => [...cs, blankCondition()])} className="self-start text-xs font-semibold text-blue-600 hover:underline">+ condition</button>
        </div>
      </div>

      {/* Actions — carte verte */}
      <div className="rounded-xl border p-3" style={{ borderColor: "var(--gedify-green)", background: "var(--gedify-green-soft)" }}>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Alors (actions)</p>
        <div className="flex flex-col gap-2">
          {actions.map((a, i) => {
            const meta = ACTIONS.find((x) => x.value === a.type);
            const ak = actionKind(a.type);
            const setVal = (v: string) => setActions((as) => as.map((x, j) => (j === i ? { ...x, value: v } : x)));
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select value={a.type} onChange={(e) => setActions((as) => as.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} className={input}>
                  {ACTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
                {ak ? (
                  <div className="min-w-32 flex-1">
                    <TaxonomyAutocompleteInput kind={ak} value={a.value} onChange={setVal} className={`${input} w-full`} placeholder={meta?.placeholder ?? "valeur"} />
                  </div>
                ) : (
                  <input value={a.value} onChange={(e) => setVal(e.target.value)} placeholder={meta?.placeholder ?? "valeur"} className={`${input} flex-1 min-w-32`} />
                )}
                <button type="button" onClick={() => setActions((as) => as.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="h-4 w-4" /></button>
              </div>
            );
          })}
          <button type="button" onClick={() => setActions((as) => [...as, blankAction()])} className="self-start text-xs font-semibold text-blue-600 hover:underline">+ action</button>
        </div>
      </div>
    </div>
  );
}

export function RulesManager() {
  const [rules, setRules] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  // Création (nouveau)
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<Condition[]>([blankCondition()]);
  const [actions, setActions] = useState<Action[]>([blankAction()]);

  // Édition (règle existante dépliée)
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eConditions, setEConditions] = useState<Condition[]>([blankCondition()]);
  const [eActions, setEActions] = useState<Action[]>([blankAction()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automation/workflows", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { results?: Workflow[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRules(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const resetForm = () => {
    setName("");
    setConditions([blankCondition()]);
    setActions([blankAction()]);
    setShowForm(false);
  };

  const create = useCallback(async () => {
    if (!name.trim()) return;
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/automation/workflows", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          kind: "ged",
          enabled: true,
          trigger: "document-imported",
          logging: true,
          conditions: conditions.filter((c) => c.value.trim() || c.operator === "regex"),
          actions: actions.filter((a) => a.value.trim()),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(null);
    }
  }, [name, conditions, actions, load]);

  function openEdit(rule: Workflow) {
    if (editId === rule.id) { setEditId(null); return; }
    setEditId(rule.id);
    setShowForm(false);
    setEName(rule.name);
    setEConditions(rule.conditions.length ? rule.conditions.map((c) => ({ ...c })) : [blankCondition()]);
    setEActions(rule.actions.length ? rule.actions.map((a) => ({ ...a })) : [blankAction()]);
  }

  const save = useCallback(
    async (rule: Workflow) => {
      if (!eName.trim()) return;
      setBusy(rule.id);
      setError(null);
      try {
        const res = await fetch(`/api/automation/workflows/${rule.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: eName.trim(),
            kind: "ged",
            enabled: rule.enabled,
            trigger: rule.trigger || "document-imported",
            logging: true,
            conditions: eConditions.filter((c) => c.value.trim() || c.operator === "regex"),
            actions: eActions.filter((a) => a.value.trim()),
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
        setEditId(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setBusy(null);
      }
    },
    [eName, eConditions, eActions, load],
  );

  const toggle = useCallback(
    async (rule: Workflow) => {
      setBusy(rule.id);
      try {
        await fetch(`/api/automation/workflows/${rule.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: !rule.enabled }),
        });
        await load();
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        await fetch(`/api/automation/workflows/${id}`, { method: "DELETE", credentials: "include" });
        await load();
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const test = useCallback(async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/automation/workflows/${id}/test`, { method: "POST", credentials: "include" });
      const data = (await res.json()) as { matched?: number; message?: string; error?: string };
      setFeedback((f) => ({ ...f, [id]: data.error ? `⚠ ${data.error}` : data.message ?? `${data.matched ?? 0} correspondance(s)` }));
    } finally {
      setBusy(null);
    }
  }, []);

  const run = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        const res = await fetch(`/api/automation/workflows/${id}/run`, { method: "POST", credentials: "include" });
        const data = (await res.json()) as { applied?: number; matched?: number; message?: string; error?: string };
        setFeedback((f) => ({ ...f, [id]: data.error ? `⚠ ${data.error}` : data.message ?? `${data.applied ?? 0} appliqué(s)` }));
        await load();
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {rules.length} règle(s). Appliquées automatiquement à chaque document importé.
        </p>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setEditId(null); }}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--blue-600)" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2} /> Nouvelle règle
        </button>
      </div>

      {error ? (
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
          <TriangleAlert className="h-4 w-4" /> {error}
        </p>
      ) : null}

      {showForm ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
          <RuleFields name={name} setName={setName} conditions={conditions} setConditions={setConditions} actions={actions} setActions={setActions} />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void create()} disabled={busy === "create" || !name.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--blue-600)" }}>
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Créer la règle
            </button>
            <button type="button" onClick={resetForm} className="inline-flex h-9 items-center rounded-xl border bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>Annuler</button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune règle. Créez-en une pour automatiser le classement.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rules.map((r) => {
            const open = editId === r.id;
            return (
              <li key={r.id} className="rounded-2xl border bg-white" style={{ borderColor: "var(--border)", opacity: r.enabled ? 1 : 0.7 }}>
                {/* En-tête (clic = éditer) */}
                <div className="flex flex-wrap items-start justify-between gap-3 p-3.5">
                  <button type="button" onClick={() => openEdit(r)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                    <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${r.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{r.name}</span>
                        <span className="text-[11px] text-slate-400">{r.runCount > 0 ? `${r.runCount} exécution(s)` : "jamais exécutée"}</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                      </span>
                      <span className="mt-1 block text-xs" style={{ color: "var(--text-muted)" }}>
                        <strong>Si</strong> {r.conditions.map((c) => `${fieldLabel(c.field)} ${opLabel(c.operator)} « ${c.value} »`).join(" ET ") || "—"}
                        {" → "}
                        <strong>alors</strong> {r.actions.map((a) => `${actionLabel(a.type)} « ${a.value} »`).join(", ") || "—"}
                      </span>
                      {feedback[r.id] ? <span className="mt-1.5 block text-[12px] font-semibold text-emerald-700">{feedback[r.id]}</span> : null}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn title="Modifier" onClick={() => openEdit(r)} busy={false}><Pencil className="h-4 w-4" /></IconBtn>
                    <IconBtn title="Tester" onClick={() => void test(r.id)} busy={busy === r.id}><FlaskConical className="h-4 w-4" /></IconBtn>
                    <IconBtn title="Appliquer à l'existant" onClick={() => void run(r.id)} busy={busy === r.id}><Play className="h-4 w-4" /></IconBtn>
                    <IconBtn title={r.enabled ? "Désactiver" : "Activer"} onClick={() => void toggle(r)} busy={busy === r.id}><Power className={`h-4 w-4 ${r.enabled ? "text-emerald-600" : "text-slate-400"}`} /></IconBtn>
                    <IconBtn title="Supprimer" onClick={() => void remove(r.id)} busy={busy === r.id} danger><Trash2 className="h-4 w-4" /></IconBtn>
                  </div>
                </div>

                {/* Éditeur déplié */}
                {open ? (
                  <div className="space-y-3 border-t p-4" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
                    <RuleFields name={eName} setName={setEName} conditions={eConditions} setConditions={setEConditions} actions={eActions} setActions={setEActions} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void save(r)} disabled={busy === r.id || !eName.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--blue-600)" }}>
                        {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
                      </button>
                      <button type="button" onClick={() => setEditId(null)} className="inline-flex h-9 items-center rounded-xl border bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>Fermer</button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, busy, title, danger }: { children: React.ReactNode; onClick: () => void; busy: boolean; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-50 ${danger ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}
