"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Play, Plus, Workflow as WorkflowIcon } from "lucide-react";
import { WorkflowCard, type WorkflowMenuAction } from "./workflow-card";
import { WorkflowDetailsPanel } from "./workflow-details-panel";
import type { Workflow } from "./workflow-fields";

const API = "/api/automation/workflows";

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return "—";
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** Page Workflows refondue : résumé compact + liste à gauche + panneau de détail
    à droite (drawer en mobile/tablette), même logique graphique que la page
    Emails & boîtes connectées. Branché sur le vrai modèle (/api/automation/workflows). */
export function WorkflowsManager() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(API, { credentials: "include", cache: "no-store" });
      const d = (await res.json()) as { results?: Workflow[]; error?: string };
      if (!res.ok || d.error) throw new Error(d.error ?? `HTTP ${res.status}`);
      setWorkflows(d.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => workflows.find((w) => w.id === selectedId) ?? null, [workflows, selectedId]);
  const activeCount = workflows.filter((w) => w.enabled).length;
  const totalRuns = workflows.reduce((n, w) => n + (w.runCount ?? 0), 0);
  const lastRun = workflows.map((w) => w.lastRunAt).filter(Boolean).sort().slice(-1)[0] ?? null;

  async function run(id: string) {
    setBusyId(id);
    try { await fetch(`${API}/${id}/run`, { method: "POST", credentials: "include" }).catch(() => {}); await load(); }
    finally { setBusyId(null); }
  }
  async function runAll() {
    setRunningAll(true);
    try {
      for (const w of workflows.filter((x) => x.enabled)) {
        await fetch(`${API}/${w.id}/run`, { method: "POST", credentials: "include" }).catch(() => {});
      }
      await load();
    } finally { setRunningAll(false); }
  }
  async function onMenu(w: Workflow, action: WorkflowMenuAction) {
    if (action === "delete") {
      if (!window.confirm(`Supprimer le workflow « ${w.name} » ?`)) return;
      setBusyId(w.id);
      try { await fetch(`${API}/${w.id}`, { method: "DELETE", credentials: "include" }).catch(() => {}); if (selectedId === w.id) setSelectedId(null); await load(); }
      finally { setBusyId(null); }
      return;
    }
    if (action === "toggle") {
      setBusyId(w.id);
      try { await fetch(`${API}/${w.id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !w.enabled }) }).catch(() => {}); await load(); }
      finally { setBusyId(null); }
      return;
    }
    if (action === "duplicate") {
      setBusyId(w.id);
      try {
        await fetch(API, { method: "POST", credentials: "include", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: `${w.name} (copie)`, description: w.description, kind: "ged", enabled: false, trigger: w.trigger, priority: w.priority, logging: true, conditions: w.conditions, actions: w.actions }) }).catch(() => {});
        await load();
      } finally { setBusyId(null); }
      return;
    }
    if (action === "test") { setSelectedId(w.id); setCreating(false); return; }
  }

  function openCreate() { setCreating(true); setSelectedId(null); }
  function openSettings(id: string) { setCreating(false); setSelectedId(id); }
  async function onSaved() { setCreating(false); await load(); }

  const panelOpen = creating || selected !== null;
  const panelNode = panelOpen ? (
    <WorkflowDetailsPanel
      key={creating ? "new" : selected!.id}
      workflow={creating ? null : selected}
      onClose={() => { setCreating(false); setSelectedId(null); }}
      onSaved={() => void onSaved()}
    />
  ) : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>Workflows</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>Automatisez le classement et le traitement de vos documents.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void runAll()} disabled={runningAll || activeCount === 0} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3.5 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border-strong)", color: "var(--text-main)" }}>
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" strokeWidth={1.85} />} Exécuter les workflows
          </button>
          <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Nouvelle règle
          </button>
        </div>
      </header>

      {workflows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-2xl border bg-white px-4 py-2.5 text-[12.5px]" style={{ borderColor: "var(--border)" }}>
          <Sum icon={WorkflowIcon} color="#15803D">{activeCount} workflow{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}</Sum>
          <Sum icon={Play} color="var(--text-muted)">{totalRuns} exécution{totalRuns > 1 ? "s" : ""} au total</Sum>
          <Sum icon={Clock} color="var(--text-muted)">Dernière exécution {relTime(lastRun)}</Sum>
          <Sum icon={CheckCircle2} color="#15803D">0 erreur</Sum>
        </div>
      ) : null}

      {error ? <p className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-semibold" style={{ borderColor: "#FDE68A", background: "#FFF7ED", color: "#9A3412" }}><AlertTriangle className="h-4 w-4" /> {error}</p> : null}

      {loading ? (
        <p className="flex items-center gap-2 py-6 text-[13px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement des workflows…</p>
      ) : workflows.length === 0 && !creating ? (
        <div className="rounded-2xl border bg-white px-6 py-16 text-center" style={{ borderColor: "var(--border)" }}>
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><WorkflowIcon className="h-6 w-6" strokeWidth={1.6} /></span>
          <p className="text-[15px] font-bold" style={{ color: "var(--text-main)" }}>Aucun workflow</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Créez une règle pour automatiser le classement de vos documents.</p>
          <button type="button" onClick={openCreate} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--accent)" }}><Plus className="h-4 w-4" strokeWidth={2.5} /> Nouvelle règle</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {workflows.map((w) => (
              <WorkflowCard key={w.id} workflow={w} selected={!creating && selectedId === w.id} busy={busyId === w.id}
                onOpen={() => openSettings(w.id)} onRun={() => void run(w.id)} onMenu={(a) => void onMenu(w, a)} />
            ))}
          </div>

          <div className="hidden lg:block">
            {panelNode ?? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border bg-white p-8 text-center" style={{ borderColor: "var(--border)" }}>
                <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Sélectionnez un workflow</p>
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Choisissez une règle pour afficher ses paramètres, ou créez-en une nouvelle.</p>
              </div>
            )}
          </div>

          {panelOpen ? (
            <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true">
              <button type="button" aria-label="Fermer" onClick={() => { setCreating(false); setSelectedId(null); }} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
              <div className="absolute inset-y-0 right-0 w-full max-w-md p-3">{panelNode}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Sum({ icon: Icon, color, children }: { icon: React.ElementType; color: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color }}><Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> {children}</span>;
}
