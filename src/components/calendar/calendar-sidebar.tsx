"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Calendar, CalendarClock, ChevronLeft, ChevronRight, Clock, ListChecks, Repeat, Settings2 } from "lucide-react";
import { CreateCalendarItemButton } from "@/components/calendar/create-calendar-item-button";
import { CalendarAgendasPanel } from "@/components/calendar/calendar-agendas-panel";

/* Sidebar métier Agenda & tâches (façon Google Calendar, charte GEDify) :
   titre + sous-titre, bouton Nouvelle tâche, entrées de navigation, mini
   calendrier, « Mes agendas » (cases on/off), accès « Gérer les agendas ». */

const DAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const ENTRIES: { href: string; label: string; icon: typeof Calendar }[] = [
  { href: "/calendrier", label: "Calendrier", icon: Calendar },
  { href: "/calendrier?vue=detectes", label: "Rendez-vous détectés", icon: CalendarClock },
  { href: "/rappels", label: "Mes tâches", icon: ListChecks },
  { href: "/rappels/a-venir", label: "À venir", icon: Clock },
  { href: "/rappels/en-retard", label: "En retard", icon: AlertTriangle },
  { href: "/rappels/recurrents", label: "Tâches automatiques", icon: Repeat },
];

export function CalendarSidebar() {
  const router = useRouter();
  const pathname = usePathname();
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
      {/* Titre + sous-titre */}
      <div>
        <h2 className="text-[17px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>Agenda &amp; tâches</h2>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>Calendrier, tâches, rappels &amp; échéances</p>
      </div>

      <CreateCalendarItemButton
        label="Nouvelle tâche"
        defaultTab="task"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold text-white shadow-sm transition hover:opacity-90"
      />

      {/* Entrées de navigation */}
      <nav className="space-y-0.5">
        {ENTRIES.map((e) => {
          const active = e.href === "/calendrier" && pathname === "/calendrier";
          return (
            <Link key={e.label} href={e.href} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-muted)" }}>
              <e.icon className="h-4 w-4 shrink-0" strokeWidth={1.85} style={{ color: active ? "var(--accent)" : "var(--text-hint)" }} aria-hidden="true" /> {e.label}
            </Link>
          );
        })}
      </nav>

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

      {/* Mes agendas : cases on/off (local + Google) + légende */}
      <CalendarAgendasPanel />

      {/* Gérer les agendas */}
      <Link href="/emails/comptes" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ color: "var(--text-muted)" }}>
        <Settings2 className="h-4 w-4 shrink-0" strokeWidth={1.85} style={{ color: "var(--text-hint)" }} aria-hidden="true" /> Gérer les agendas
      </Link>
    </div>
  );
}
