"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Calendar, CalendarClock, CheckSquare, ChevronLeft, ChevronRight, Clock, ListChecks, Repeat } from "lucide-react";
import { CreateCalendarItemButton } from "@/components/calendar/create-calendar-item-button";

/* Colonne de navigation de l'agenda (façon Google Calendar) : bouton Nouveau,
   mini-calendrier mensuel navigable, sélecteur de vues, accès rapides. */

const DAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const VIEWS: { key: string; label: string }[] = [
  { key: "jour", label: "Jour" },
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
  { key: "annee", label: "Année" },
  { key: "liste", label: "Liste" },
];

const QUICK: { href: string; label: string; icon: typeof Calendar }[] = [
  { href: "/calendrier", label: "Calendrier", icon: Calendar },
  { href: "/calendrier?vue=detectes", label: "Rendez-vous détectés", icon: CalendarClock },
  { href: "/rappels", label: "Mes tâches", icon: ListChecks },
  { href: "/rappels/a-venir", label: "À venir", icon: Clock },
  { href: "/rappels/en-retard", label: "En retard", icon: AlertTriangle },
  { href: "/rappels/recurrents", label: "Tâches automatiques", icon: Repeat },
];

export function CalendarSidebar({ currentView }: { currentView: string }) {
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
    router.push(`/calendrier?view=jour&d=${d}`);
  }

  return (
    <div className="space-y-4">
      <CreateCalendarItemButton className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white shadow-sm transition hover:opacity-90" />

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

      {/* Vues */}
      <div className="rounded-2xl border bg-white p-2" style={{ borderColor: "var(--border)" }}>
        <p className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Affichage</p>
        <div className="grid grid-cols-2 gap-1">
          {VIEWS.map((v) => {
            const active = (currentView || "mois") === v.key || (v.key === "mois" && !currentView);
            return (
              <Link key={v.key} href={v.key === "mois" ? "/calendrier" : `/calendrier?view=${v.key}`} className="rounded-lg px-2 py-1.5 text-center text-[12px] font-semibold transition" style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-muted)" }}>{v.label}</Link>
            );
          })}
        </div>
      </div>

      {/* Accès rapides */}
      <div className="rounded-2xl border bg-white p-2" style={{ borderColor: "var(--border)" }}>
        <p className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Accès rapides</p>
        <ul className="space-y-0.5">
          {QUICK.map((q) => (
            <li key={q.label}>
              <Link href={q.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ color: "var(--text-muted)" }}>
                <q.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} style={{ color: "var(--text-hint)" }} aria-hidden="true" /> {q.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Légende agendas (couleurs) */}
      <div className="rounded-2xl border bg-white p-2.5" style={{ borderColor: "var(--border)" }}>
        <p className="pb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Agendas</p>
        <div className="space-y-1 text-[12px]" style={{ color: "var(--text-main)" }}>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--gedify-purple)" }} /> Mes rendez-vous</span>
          <span className="flex items-center gap-2"><CheckSquare className="h-3.5 w-3.5" style={{ color: "var(--gedify-info)" }} strokeWidth={1.85} /> Tâches</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--gedify-orange)" }} /> Échéances</span>
        </div>
      </div>
    </div>
  );
}
