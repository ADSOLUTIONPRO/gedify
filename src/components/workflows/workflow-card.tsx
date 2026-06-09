"use client";

import { useState } from "react";
import { Clock, Filter, Loader2, MoreVertical, Play, Settings2, Zap } from "lucide-react";
import { triggerLabel, type Workflow } from "./workflow-fields";

export type WorkflowMenuAction = "toggle" | "duplicate" | "test" | "delete";

function relTime(iso: string | null): string {
  if (!iso) return "Jamais exécuté";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return "Jamais exécuté";
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function WorkflowCard({
  workflow, selected, busy, onOpen, onRun, onMenu,
}: {
  workflow: Workflow;
  selected: boolean;
  busy: boolean;
  onOpen: () => void;
  onRun: () => void;
  onMenu: (a: WorkflowMenuAction) => void;
}) {
  const [menu, setMenu] = useState(false);
  const status = workflow.enabled ? { label: "Actif", color: "#15803D", bg: "var(--gedify-green-soft)" } : { label: "Inactif", color: "#64748B", bg: "var(--bg-card-soft)" };

  return (
    <article className="rounded-2xl border bg-white p-4 transition" style={{ borderColor: selected ? "var(--accent)" : "var(--border)", boxShadow: selected ? "0 0 0 1px var(--accent)" : undefined, background: selected ? "var(--accent-soft)" : "#fff" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-bold" style={{ color: "var(--text-main)" }}>{workflow.name || "(sans nom)"}</p>
          {workflow.description ? <p className="truncate text-[12px]" style={{ color: "var(--text-muted)" }}>{workflow.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: status.color, background: status.bg }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} aria-hidden="true" /> {status.label}
          </span>
          <div className="relative">
            <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Actions du workflow" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><MoreVertical className="h-4 w-4" strokeWidth={2} /></button>
            {menu ? (
              <>
                <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-8 z-50 w-52 overflow-hidden rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: "var(--border)" }} role="menu">
                  {([
                    ["toggle", workflow.enabled ? "Désactiver" : "Activer"],
                    ["duplicate", "Dupliquer"],
                    ["test", "Tester (simulation)"],
                    ["delete", "Supprimer"],
                  ] as [WorkflowMenuAction, string][]).map(([a, label]) => (
                    <button key={a} type="button" onClick={() => { setMenu(false); onMenu(a); }} className="flex w-full items-center px-3 py-1.5 text-left text-[12.5px] transition hover:bg-slate-50" style={{ color: a === "delete" ? "var(--danger)" : "var(--text-main)" }} role="menuitem">{label}</button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <Chip icon={Zap}>{triggerLabel(workflow.trigger)}</Chip>
        <Chip icon={Filter}>{workflow.conditions.length} condition{workflow.conditions.length > 1 ? "s" : ""}</Chip>
        <Chip icon={Settings2}>{workflow.actions.length} action{workflow.actions.length > 1 ? "s" : ""}</Chip>
      </div>

      <div className="mt-2.5 flex items-center gap-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
        <span>{workflow.runCount} exécution{workflow.runCount > 1 ? "s" : ""}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" strokeWidth={1.75} /> {relTime(workflow.lastRunAt)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={onRun} disabled={busy} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" strokeWidth={1.85} />} Exécuter
        </button>
        <button type="button" onClick={onOpen} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.85} /> Paramètres
        </button>
      </div>
    </article>
  );
}

function Chip({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
      <Icon className="h-3 w-3" strokeWidth={1.85} aria-hidden="true" /> {children}
    </span>
  );
}
