"use client";

import { useState } from "react";
import { Filter, History, Info, Loader2, Play, Save, Settings2, X, Zap } from "lucide-react";
import {
  ActionsEditor, ConditionsEditor, TRIGGERS, blankAction, blankCondition,
  type Workflow, type WorkflowAction, type WorkflowCondition,
} from "./workflow-fields";

type Tab = "info" | "trigger" | "conditions" | "actions" | "history";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "info", label: "Informations", icon: Info },
  { key: "trigger", label: "Déclencheur", icon: Zap },
  { key: "conditions", label: "Conditions", icon: Filter },
  { key: "actions", label: "Actions", icon: Settings2 },
  { key: "history", label: "Historique", icon: History },
];

const inputCls = "h-9 w-full rounded-lg border px-2.5 text-[13px] outline-none focus:border-[var(--accent)]";

function relTime(iso: string | null): string {
  if (!iso) return "Jamais";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return "Jamais";
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** Panneau de détail/édition d'un workflow (création si workflow=null). */
export function WorkflowDetailsPanel({
  workflow,
  onClose,
  onSaved,
}: {
  workflow: Workflow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = workflow === null;
  const [tab, setTab] = useState<Tab>("info");
  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const [priority, setPriority] = useState(workflow?.priority ?? 0);
  const [trigger, setTrigger] = useState(workflow?.trigger ?? "document-imported");
  const [conditions, setConditions] = useState<WorkflowCondition[]>(workflow?.conditions?.length ? workflow.conditions.map((c) => ({ ...c })) : [blankCondition()]);
  const [actions, setActions] = useState<WorkflowAction[]>(workflow?.actions?.length ? workflow.actions.map((a) => ({ ...a })) : [blankAction()]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true); setMsg(null);
    try {
      const body = {
        name: name.trim(), description: description.trim(), kind: "ged", enabled, trigger, priority, logging: true,
        conditions: conditions.filter((c) => c.value.trim() || c.operator === "regex"),
        actions: actions.filter((a) => a.value.trim()),
      };
      const res = await fetch(isCreate ? "/api/automation/workflows" : `/api/automation/workflows/${workflow!.id}`, {
        method: isCreate ? "POST" : "PUT",
        credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setMsg("Enregistré.");
      onSaved();
    } catch {
      setMsg("Échec de l'enregistrement.");
    } finally { setSaving(false); }
  }

  async function test() {
    if (isCreate || testing) return;
    setTesting(true); setMsg(null);
    try {
      const res = await fetch(`/api/automation/workflows/${workflow!.id}/test`, { method: "POST", credentials: "include" });
      const d = (await res.json().catch(() => ({}))) as { matched?: number; message?: string };
      setMsg(d.message ?? (d.matched != null ? `${d.matched} document(s) correspondraient.` : "Simulation effectuée."));
    } catch {
      setMsg("Simulation impossible.");
    } finally { setTesting(false); }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{isCreate ? "Nouvelle règle" : "Détails du workflow"}</p>
          <p className="flex items-center gap-1.5 truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
            <span className="inline-flex items-center gap-1 font-bold" style={{ color: enabled ? "var(--gedify-green)" : "var(--text-hint)" }}>● {enabled ? "Actif" : "Inactif"}</span>
            · {TRIGGERS.find((t) => t.value === trigger)?.label ?? trigger}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" strokeWidth={2} /></button>
      </div>

      <div className="grid grid-cols-3 gap-1 border-b p-2 sm:grid-cols-5" style={{ borderColor: "var(--border-soft)" }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition"
              style={{ background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--text-muted)" }}>
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden="true" /> <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {tab === "info" ? (
          <>
            <div><Label>Nom du workflow</Label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Factures EDF → Énergie" className={inputCls} style={{ borderColor: "var(--border)" }} /></div>
            <div><Label>Description</Label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="À quoi sert cette règle ?" className="w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} /></div>
            <Toggle label="Workflow actif" checked={enabled} onChange={() => setEnabled((v) => !v)} />
            <div><Label>Priorité</Label><input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} className={`${inputCls} max-w-28`} style={{ borderColor: "var(--border)" }} /></div>
          </>
        ) : null}

        {tab === "trigger" ? (
          <div><Label>Déclencheur</Label>
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className={inputCls} style={{ borderColor: "var(--border)" }}>
              {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-hint)" }}>Le workflow s&apos;exécute lorsque cet événement se produit sur un document.</p>
          </div>
        ) : null}

        {tab === "conditions" ? (
          <div>
            <p className="mb-2 text-[12px]" style={{ color: "var(--text-muted)" }}>Si <strong style={{ color: "var(--text-main)" }}>toutes</strong> les conditions sont remplies :</p>
            <ConditionsEditor conditions={conditions} setConditions={setConditions} />
          </div>
        ) : null}

        {tab === "actions" ? (
          <div>
            <p className="mb-2 text-[12px]" style={{ color: "var(--text-muted)" }}>Alors exécuter :</p>
            <ActionsEditor actions={actions} setActions={setActions} />
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[12.5px]">
              <InfoLine label="Exécutions" value={String(workflow?.runCount ?? 0)} />
              <InfoLine label="Dernière exécution" value={relTime(workflow?.lastRunAt ?? null)} />
            </div>
            {!isCreate ? (
              <button type="button" onClick={() => void test()} disabled={testing} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" strokeWidth={1.85} />} Tester (simulation)
              </button>
            ) : null}
            <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>Le journal détaillé par exécution sera ajouté ultérieurement.</p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-4 py-3" style={{ borderColor: "var(--border-soft)" }}>
        {msg ? <span className="text-[12px] font-semibold" style={{ color: msg.startsWith("Échec") || msg.includes("impossible") ? "var(--danger)" : "var(--gedify-green)" }}>{msg}</span> : <span />}
        <button type="button" onClick={() => void save()} disabled={saving || !name.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2} />} Enregistrer
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>{children}</p>;
}
function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border)" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-semibold" style={{ color: "var(--text-main)" }}>{value}</span>
    </div>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{label}</p>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className="relative h-6 w-11 shrink-0 rounded-full transition" style={{ background: checked ? "var(--accent)" : "var(--border-strong)" }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: checked ? "1.375rem" : "0.125rem" }} />
      </button>
    </div>
  );
}
