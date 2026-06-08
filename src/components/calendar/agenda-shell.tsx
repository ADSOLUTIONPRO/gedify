"use client";

import { useState, type ReactNode } from "react";
import { PanelLeft, SlidersHorizontal, X } from "lucide-react";
import { CreateCalendarItemButton } from "@/components/calendar/create-calendar-item-button";

/* ────────────────────────────────────────────────────────────────────────
   AgendaShell — mise en page responsive de l'agenda.
   • Desktop (lg+) : 3 colonnes inline (sidebar / calendrier / panneau).
   • Tablette / mobile : sidebar et panneau dans des tiroirs (drawers),
     calendrier prioritaire, bouton « Nouveau » sticky.
   ──────────────────────────────────────────────────────────────────────── */

export function AgendaShell({ sidebar, rightPanel, children }: { sidebar: ReactNode; rightPanel: ReactNode; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div>
      {/* Barre de contrôles mobile/tablette */}
      <div className="mb-3 flex items-center gap-2 lg:hidden">
        <button type="button" onClick={() => setSidebarOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <PanelLeft className="h-4 w-4" strokeWidth={1.85} /> Agenda
        </button>
        <button type="button" onClick={() => setPanelOpen(true)} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.85} /> Panneau
        </button>
      </div>

      {/* Mise en page 3 colonnes (desktop) */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="hidden shrink-0 lg:block lg:w-[230px]">{sidebar}</div>
        <div className="min-w-0 flex-1">{children}</div>
        <div className="hidden lg:block">{rightPanel}</div>
      </div>

      {/* Tiroir sidebar (mobile) */}
      {sidebarOpen ? (
        <Drawer side="left" title="Agenda & tâches" onClose={() => setSidebarOpen(false)}>{sidebar}</Drawer>
      ) : null}
      {/* Tiroir panneau droit (mobile) */}
      {panelOpen ? (
        <Drawer side="right" title="Détails" onClose={() => setPanelOpen(false)}>{rightPanel}</Drawer>
      ) : null}

      {/* Bouton « Nouveau » sticky (mobile/tablette) */}
      <div className="fixed bottom-5 right-5 z-40 lg:hidden">
        <CreateCalendarItemButton label="Nouveau" className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-bold text-white shadow-xl transition hover:opacity-90" />
      </div>
    </div>
  );
}

function Drawer({ side, title, onClose, children }: { side: "left" | "right"; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
      <div className={`absolute top-0 ${side === "left" ? "left-0" : "right-0"} flex h-full w-[86%] max-w-[340px] flex-col overflow-y-auto p-4`} style={{ background: "var(--bg-page)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" strokeWidth={2} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
