"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { CreateCalendarItemButton } from "@/components/calendar/create-calendar-item-button";

/* ────────────────────────────────────────────────────────────────────────
   AgendaShell — mise en page du CONTENU de l'agenda (la sidebar gauche est
   celle de l'espace « Agenda & tâches », rendue par le layout : on ne la
   reduplique pas ici).
   • Desktop (lg+) : calendrier (dominant) + panneau droit compact.
   • Tablette / mobile : panneau droit en tiroir, bouton « Nouveau » sticky.
   ──────────────────────────────────────────────────────────────────────── */

export function AgendaShell({ rightPanel, children }: { rightPanel: ReactNode; children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div>
      {/* Bouton d'accès au panneau (mobile/tablette) */}
      <div className="mb-3 flex justify-end lg:hidden">
        <button type="button" onClick={() => setPanelOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.85} /> Panneau
        </button>
      </div>

      {/* Calendrier (dominant) + panneau droit */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="hidden lg:block">{rightPanel}</div>
      </div>

      {/* Tiroir panneau droit (mobile) */}
      {panelOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Détails">
          <button type="button" aria-label="Fermer" onClick={() => setPanelOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 flex h-full w-[86%] max-w-[340px] flex-col overflow-y-auto p-4" style={{ background: "var(--bg-page)" }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Détails</h2>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" strokeWidth={2} /></button>
            </div>
            {rightPanel}
          </div>
        </div>
      ) : null}

      {/* Bouton « Nouveau » sticky (mobile/tablette) */}
      <div className="fixed bottom-5 right-5 z-40 lg:hidden">
        <CreateCalendarItemButton label="Nouveau" className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-bold text-white shadow-xl transition hover:opacity-90" />
      </div>
    </div>
  );
}
