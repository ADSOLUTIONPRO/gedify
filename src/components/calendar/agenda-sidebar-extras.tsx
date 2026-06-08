"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarAgendasPanel } from "@/components/calendar/calendar-agendas-panel";

/* Widgets de l'espace Agenda injectés DANS la sidebar d'espace (une seule
   sidebar gauche) : mini-calendrier + « Mes agendas » (cases on/off + iCloud).
   L'en-tête, le bouton « Nouvelle tâche » et le menu viennent déjà du menu
   d'espace (space-menus.ts → SpaceMenuInner). */

const DAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function AgendaSidebarExtras({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [refMonth, setRefMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const year = refMonth.getFullYear();
  const month = refMonth.getMonth();
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();

  function pickDay(day: number) {
    const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onNavigate?.();
    router.push(`/calendrier?view=jour&d=${d}`);
  }

  return (
    <div className="space-y-3">
      {/* Mini-calendrier */}
      <div className="rounded-2xl border bg-white p-3" style={{ borderColor: "var(--border)" }}>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[12.5px] font-bold capitalize" style={{ color: "var(--text-main)" }}>{MONTHS[month]} {year}</p>
          <div className="flex items-center gap-0.5">
            <button type="button" aria-label="Mois précédent" onClick={() => setRefMonth(new Date(year, month - 1, 1))} className="flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)]" style={{ color: "var(--text-muted)" }}><ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} /></button>
            <button type="button" aria-label="Mois suivant" onClick={() => setRefMonth(new Date(year, month + 1, 1))} className="flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)]" style={{ color: "var(--text-muted)" }}><ChevronRight className="h-3.5 w-3.5" strokeWidth={2} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {DAY_INITIALS.map((d, i) => <span key={i} className="py-0.5 text-[9.5px] font-bold" style={{ color: "var(--text-hint)" }}>{d}</span>)}
          {Array.from({ length: firstOffset }, (_, i) => <span key={`e${i}`} />)}
          {Array.from({ length: daysIn }, (_, i) => {
            const day = i + 1;
            const isToday = `${year}-${month}-${day}` === todayKey;
            return (
              <button key={day} type="button" onClick={() => pickDay(day)} className="flex h-7 items-center justify-center rounded-full text-[11.5px] transition hover:bg-[var(--accent-soft)]" style={isToday ? { background: "var(--accent)", color: "#fff", fontWeight: 700 } : { color: "var(--text-main)" }}>{day}</button>
            );
          })}
        </div>
      </div>

      {/* Mes agendas (cases on/off + légende + connexion iCloud) */}
      <CalendarAgendasPanel />
    </div>
  );
}
