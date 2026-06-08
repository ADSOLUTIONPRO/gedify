"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CreateCalendarItemModal, type EditableEvent } from "@/components/calendar/create-calendar-item-modal";

/* ────────────────────────────────────────────────────────────────────────
   Vues temporelles de l'agenda : Jour, Semaine, Année. Données = socle
   CalendarEvent (récupéré côté client) + éléments « toute la journée » fournis
   par le serveur (actions/échéances). Clic sur un créneau → création préremplie ;
   clic sur un événement → édition. Navigation précédent/suivant/aujourd'hui.
   ──────────────────────────────────────────────────────────────────────── */

type AllDayItem = { date: string; label: string; tone: string; href: string };
type Evt = EditableEvent & { allDay: boolean; location: { displayName?: string | null } | null; color: string | null };

const TONE: Record<string, string> = { blue: "var(--gedify-info)", violet: "var(--gedify-purple)", emerald: "var(--gedify-green)", amber: "var(--gedify-orange)", rose: "#E11D48" };
const HOUR_H = 44; // px par heure
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function startOfWeek(d: Date) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export function CalendarTimeViews({ view, allDayItems, todayISO, initialDateISO }: { view: "jour" | "semaine" | "annee"; allDayItems: AllDayItem[]; todayISO: string; initialDateISO?: string }) {
  const router = useRouter();
  const [refDate, setRefDate] = useState(() => {
    const base = initialDateISO ? new Date(initialDateISO) : new Date(todayISO);
    return Number.isNaN(base.getTime()) ? new Date(todayISO) : base;
  });
  const [events, setEvents] = useState<Evt[]>([]);
  const [createAt, setCreateAt] = useState<string | null>(null);
  const [editing, setEditing] = useState<Evt | null>(null);

  // Plage visible selon la vue.
  const range = useMemo(() => {
    if (view === "annee") return { from: new Date(refDate.getFullYear(), 0, 1), to: new Date(refDate.getFullYear() + 1, 0, 1) };
    if (view === "semaine") { const s = startOfWeek(refDate); return { from: s, to: addDays(s, 7) }; }
    const s = new Date(refDate); s.setHours(0, 0, 0, 0); return { from: s, to: addDays(s, 1) };
  }, [view, refDate]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar/events?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`, { credentials: "include", cache: "no-store" });
      if (res.ok) { const data = (await res.json()) as { events?: Evt[] }; setEvents(data.events ?? []); }
    } catch { /* hors-ligne */ }
  }, [range.from, range.to]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const go = (dir: -1 | 0 | 1) => {
    if (dir === 0) { setRefDate(new Date(todayISO)); return; }
    setRefDate((d) => {
      if (view === "annee") return new Date(d.getFullYear() + dir, d.getMonth(), 1);
      if (view === "semaine") return addDays(d, dir * 7);
      return addDays(d, dir);
    });
  };

  const title = useMemo(() => {
    if (view === "annee") return String(refDate.getFullYear());
    if (view === "semaine") { const s = startOfWeek(refDate); const e = addDays(s, 6); return `Semaine du ${s.getDate()} ${MONTH_NAMES[s.getMonth()].toLowerCase()} au ${e.getDate()} ${MONTH_NAMES[e.getMonth()].toLowerCase()} ${e.getFullYear()}`; }
    return refDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [view, refDate]);

  const onCreated = () => { setCreateAt(null); setEditing(null); void load(); router.refresh(); };

  return (
    <div>
      {/* Navigation */}
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={() => go(0)} className="inline-flex h-9 items-center rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Aujourd&apos;hui</button>
        <button type="button" onClick={() => go(-1)} aria-label="Précédent" className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><ChevronLeft className="h-4 w-4" strokeWidth={2} /></button>
        <button type="button" onClick={() => go(1)} aria-label="Suivant" className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><ChevronRight className="h-4 w-4" strokeWidth={2} /></button>
        <p className="ml-1 text-[14px] font-extrabold capitalize" style={{ color: "var(--text-main)" }}>{title}</p>
      </div>

      {view === "annee" ? (
        <YearView refDate={refDate} events={events} allDayItems={allDayItems} onPickDay={(d) => { setRefDate(d); router.push("/calendrier?view=jour"); }} />
      ) : (
        <TimeGrid
          days={view === "semaine" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(refDate), i)) : [new Date(refDate)]}
          events={events}
          allDayItems={allDayItems}
          todayISO={todayISO}
          onSlot={(iso) => setCreateAt(iso)}
          onEvent={(ev) => setEditing(ev)}
        />
      )}

      {createAt ? <CreateCalendarItemModal prefill={{ startISO: createAt }} onClose={() => setCreateAt(null)} onCreated={onCreated} /> : null}
      {editing ? <CreateCalendarItemModal editEvent={editing} onClose={() => setEditing(null)} onCreated={onCreated} /> : null}
    </div>
  );
}

function TimeGrid({ days, events, allDayItems, todayISO, onSlot, onEvent }: {
  days: Date[]; events: Evt[]; allDayItems: AllDayItem[]; todayISO: string;
  onSlot: (iso: string) => void; onEvent: (ev: Evt) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const todayY = ymd(new Date(todayISO));
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
      {/* En-tête jours */}
      <div className="grid border-b" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)`, borderColor: "var(--border-soft)" }}>
        <div />
        {days.map((d) => {
          const isToday = ymd(d) === todayY;
          return (
            <div key={d.toISOString()} className="border-l py-1.5 text-center" style={{ borderColor: "var(--border-soft)" }}>
              <span className="text-[11px] font-bold uppercase" style={{ color: "var(--text-hint)" }}>{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
              <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-bold" style={isToday ? { background: "var(--accent)", color: "#fff" } : { color: "var(--text-main)" }}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Toute la journée */}
      <div className="grid border-b" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)`, borderColor: "var(--border-soft)", background: "var(--bg-card-soft)" }}>
        <div className="py-1 pr-1 text-right text-[10px] font-semibold" style={{ color: "var(--text-hint)" }}>jour</div>
        {days.map((d) => {
          const dy = ymd(d);
          const items = [
            ...allDayItems.filter((a) => a.date.slice(0, 10) === dy),
            ...events.filter((e) => e.allDay && e.start.slice(0, 10) === dy).map((e) => ({ date: e.start, label: e.title, tone: "violet", href: "", ev: e })),
          ];
          return (
            <div key={dy} className="min-h-[26px] space-y-0.5 border-l p-1" style={{ borderColor: "var(--border-soft)" }}>
              {items.map((it, i) => (
                <button key={i} type="button" onClick={() => "ev" in it && it.ev ? onEvent(it.ev as Evt) : undefined} className="block w-full truncate rounded px-1 py-0.5 text-left text-[10.5px] font-semibold text-white" style={{ background: TONE[it.tone] ?? "var(--gedify-purple)" }}>{it.label}</button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Grille horaire */}
      <div className="relative grid max-h-[560px] overflow-y-auto" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
        <div>
          {hours.map((h) => (
            <div key={h} className="pr-1 text-right text-[10px]" style={{ height: HOUR_H, color: "var(--text-hint)" }}>{String(h).padStart(2, "0")}:00</div>
          ))}
        </div>
        {days.map((d) => {
          const dy = ymd(d);
          const timed = events.filter((e) => !e.allDay && e.start.slice(0, 10) === dy);
          return (
            <div key={dy} className="relative border-l" style={{ borderColor: "var(--border-soft)" }}>
              {hours.map((h) => (
                <button key={h} type="button" onClick={() => { const dt = new Date(d); dt.setHours(h, 0, 0, 0); onSlot(dt.toISOString()); }} className="block w-full border-b transition hover:bg-[var(--accent-soft)]" style={{ height: HOUR_H, borderColor: "var(--border-soft)" }} aria-label={`Créer à ${h}:00`} />
              ))}
              {timed.map((e) => {
                const s = new Date(e.start); const en = e.end ? new Date(e.end) : new Date(s.getTime() + 3600000);
                const top = (s.getHours() + s.getMinutes() / 60) * HOUR_H;
                const height = Math.max(18, ((en.getTime() - s.getTime()) / 3600000) * HOUR_H);
                return (
                  <button key={e.id} type="button" onClick={() => onEvent(e)} className="absolute left-1 right-1 overflow-hidden rounded-lg px-1.5 py-0.5 text-left text-[11px] font-semibold text-white shadow-sm" style={{ top, height, background: e.color ?? "var(--gedify-purple)" }}>
                    <span className="block truncate">{e.title}</span>
                    <span className="block truncate text-[10px] opacity-90">{s.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ refDate, events, allDayItems, onPickDay }: { refDate: Date; events: Evt[]; allDayItems: AllDayItem[]; onPickDay: (d: Date) => void }) {
  const year = refDate.getFullYear();
  const marked = new Set<string>([...events.map((e) => e.start.slice(0, 10)), ...allDayItems.map((a) => a.date.slice(0, 10))]);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const offset = (first.getDay() + 6) % 7;
        const daysIn = new Date(year, m + 1, 0).getDate();
        return (
          <div key={m} className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
            <p className="mb-1.5 text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>{MONTH_NAMES[m]}</p>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {DAY_NAMES.map((dn) => <span key={dn} className="text-[8.5px] font-bold" style={{ color: "var(--text-hint)" }}>{dn[0]}</span>)}
              {Array.from({ length: offset }, (_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: daysIn }, (_, i) => {
                const day = i + 1;
                const key = `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const has = marked.has(key);
                return (
                  <button key={day} type="button" onClick={() => onPickDay(new Date(year, m, day))} className="relative flex h-5 items-center justify-center rounded text-[10px] transition hover:bg-[var(--accent-soft)]" style={{ color: "var(--text-main)" }}>
                    {day}
                    {has ? <span className="absolute bottom-0 h-1 w-1 rounded-full" style={{ background: "var(--accent)" }} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
