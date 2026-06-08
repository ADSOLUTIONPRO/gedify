"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { CreateCalendarItemModal, type EditableEvent } from "@/components/calendar/create-calendar-item-modal";
import { getHiddenCalendars, subscribeCalendarVisibility } from "@/lib/calendar/calendar-visibility-store";

/* ────────────────────────────────────────────────────────────────────────
   AgendaCalendar — calendrier central façon Google Calendar (charte GEDify).
   Possède l'état de vue (Jour/Semaine/Mois/Année/Liste) et la date de
   référence ; barre d'outils unifiée ; événements du socle CalendarEvent
   récupérés côté client (+ tâches/échéances « toute la journée » fournies par
   le serveur). Drag-drop, filtrage multi-agendas, couleurs par agenda.
   ──────────────────────────────────────────────────────────────────────── */

export type AgendaView = "jour" | "semaine" | "mois" | "annee" | "liste";
export type AllDayItem = { date: string; label: string; tone: string; href: string };
type Evt = EditableEvent & { allDay: boolean; location: { displayName?: string | null } | null; color: string | null; calendarId?: string | null };
type CalendarMeta = { id: string; name: string; color: string };

const TONE: Record<string, string> = { blue: "var(--gedify-info)", violet: "var(--gedify-purple)", emerald: "var(--gedify-green)", amber: "var(--gedify-orange)", rose: "#E11D48" };
const HOUR_H = 46; // px par heure
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const VIEWS: { key: AgendaView; label: string }[] = [
  { key: "jour", label: "Jour" },
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
  { key: "annee", label: "Année" },
  { key: "liste", label: "Liste" },
];

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function startOfWeek(d: Date) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function calKeyOf(ev: Evt): string { return ev.calendarId && ev.calendarId !== "" ? ev.calendarId : "local"; }

/** Style « chip » coloré (fond teinté + bord gauche + texte) à partir d'une couleur. */
function chipStyle(color: string): React.CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} 15%, var(--surface))`,
    borderLeft: `3px solid ${color}`,
    color: `color-mix(in srgb, ${color} 78%, #243049)`,
  };
}

export function AgendaCalendar({
  initialView,
  initialDateISO,
  todayISO,
  allDayItems,
}: {
  initialView: AgendaView;
  initialDateISO?: string;
  todayISO: string;
  allDayItems: AllDayItem[];
}) {
  const router = useRouter();
  const [view, setView] = useState<AgendaView>(initialView);
  const [refDate, setRefDate] = useState(() => {
    const base = initialDateISO ? new Date(initialDateISO) : new Date(todayISO);
    return Number.isNaN(base.getTime()) ? new Date(todayISO) : base;
  });
  const [events, setEvents] = useState<Evt[]>([]);
  const [createAt, setCreateAt] = useState<string | null>(null);
  const [editing, setEditing] = useState<Evt | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [calColors, setCalColors] = useState<Record<string, string>>({});

  // Synchro de l'URL (partage / liens sidebar) sans rechargement serveur.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (view !== "mois") qs.set("view", view);
    qs.set("d", ymd(refDate));
    router.replace(`/calendrier?${qs.toString()}`, { scroll: false });
  }, [view, refDate, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(getHiddenCalendars());
    return subscribeCalendarVisibility(() => setHidden(getHiddenCalendars()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calendars", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { calendars: [] }))
      .then((d: { calendars?: CalendarMeta[] }) => {
        if (cancelled || !Array.isArray(d.calendars)) return;
        const m: Record<string, string> = {};
        d.calendars.forEach((c) => { m[c.id] = c.color; });
        setCalColors(m);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Plage à charger selon la vue (le filtrage par jour se fait ensuite).
  const range = useMemo(() => {
    if (view === "annee") return { from: new Date(refDate.getFullYear(), 0, 1), to: new Date(refDate.getFullYear() + 1, 0, 1) };
    if (view === "mois") { const first = new Date(refDate.getFullYear(), refDate.getMonth(), 1); const start = addDays(first, -((first.getDay() + 6) % 7)); return { from: start, to: addDays(start, 42) }; }
    if (view === "liste") { const first = new Date(refDate.getFullYear(), refDate.getMonth(), 1); return { from: first, to: addDays(first, 62) }; }
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

  const visibleEvents = useMemo(() => events.filter((e) => !hidden.has(calKeyOf(e))), [events, hidden]);
  const colorOf = useCallback((e: Evt) => e.color ?? calColors[calKeyOf(e)] ?? "var(--gedify-purple)", [calColors]);

  const go = (dir: -1 | 0 | 1) => {
    if (dir === 0) { setRefDate(new Date(todayISO)); return; }
    setRefDate((d) => {
      if (view === "annee") return new Date(d.getFullYear() + dir, d.getMonth(), 1);
      if (view === "mois" || view === "liste") return new Date(d.getFullYear(), d.getMonth() + dir, 1);
      if (view === "semaine") return addDays(d, dir * 7);
      return addDays(d, dir);
    });
  };

  const title = useMemo(() => {
    if (view === "annee") return String(refDate.getFullYear());
    if (view === "mois" || view === "liste") return `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`;
    if (view === "semaine") { const s = startOfWeek(refDate); const e = addDays(s, 6); return `Semaine du ${s.getDate()} ${MONTH_NAMES[s.getMonth()]} au ${e.getDate()} ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`; }
    return refDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [view, refDate]);

  const onCreated = () => { setCreateAt(null); setEditing(null); void load(); router.refresh(); };

  const moveEvent = useCallback(async (ev: Evt, newStartISO: string) => {
    const durationMs = ev.end ? new Date(ev.end).getTime() - new Date(ev.start).getTime() : 3_600_000;
    const newEndISO = new Date(new Date(newStartISO).getTime() + durationMs).toISOString();
    if (newStartISO === ev.start) return;
    setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, start: newStartISO, end: newEndISO } : e)));
    try {
      const res = await fetch(`/api/calendar/events/${ev.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ start: newStartISO, end: newEndISO }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch { void load(); }
  }, [load]);

  const days = view === "semaine"
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(refDate), i))
    : [new Date(refDate)];

  return (
    <div className="overflow-hidden rounded-2xl border bg-[var(--surface)]" style={{ borderColor: "var(--border)" }}>
      {/* Barre d'outils (façon Google Calendar) */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <button type="button" onClick={() => go(0)} className="inline-flex h-9 items-center rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Aujourd&apos;hui</button>
        <button type="button" onClick={() => go(-1)} aria-label="Précédent" className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><ChevronLeft className="h-4 w-4" strokeWidth={2} /></button>
        <button type="button" onClick={() => go(1)} aria-label="Suivant" className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><ChevronRight className="h-4 w-4" strokeWidth={2} /></button>
        <Calendar className="ml-1 h-[18px] w-[18px] shrink-0" strokeWidth={1.85} style={{ color: "var(--accent)" }} aria-hidden="true" />
        <p className="text-[15px] font-extrabold capitalize" style={{ color: "var(--text-main)" }}>{title}</p>

        {/* Sélecteur de vue */}
        <div className="ml-auto flex items-center rounded-xl border bg-white p-0.5" style={{ borderColor: "var(--border)" }}>
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <button key={v.key} type="button" onClick={() => setView(v.key)} className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition" style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-muted)" }}>{v.label}</button>
            );
          })}
        </div>
        <button type="button" aria-label="Options d'affichage" className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><SlidersHorizontal className="h-4 w-4" strokeWidth={1.85} /></button>
      </div>

      {/* Corps : vue active */}
      {view === "annee" ? (
        <YearView refDate={refDate} events={visibleEvents} allDayItems={allDayItems} onPickDay={(d) => { setRefDate(d); setView("jour"); }} />
      ) : view === "mois" ? (
        <MonthGrid refDate={refDate} events={visibleEvents} allDayItems={allDayItems} todayISO={todayISO} colorOf={colorOf} onSlot={(iso) => setCreateAt(iso)} onEvent={(ev) => setEditing(ev)} onMore={(d) => { setRefDate(d); setView("jour"); }} />
      ) : view === "liste" ? (
        <ListView events={visibleEvents} allDayItems={allDayItems} from={range.from} to={range.to} colorOf={colorOf} onEvent={(ev) => setEditing(ev)} />
      ) : (
        <TimeGrid days={days} events={visibleEvents} allDayItems={allDayItems} todayISO={todayISO} colorOf={colorOf} onSlot={(iso) => setCreateAt(iso)} onEvent={(ev) => setEditing(ev)} onMove={(ev, iso) => void moveEvent(ev, iso)} />
      )}

      {createAt ? <CreateCalendarItemModal prefill={{ startISO: createAt }} onClose={() => setCreateAt(null)} onCreated={onCreated} /> : null}
      {editing ? <CreateCalendarItemModal editEvent={editing} onClose={() => setEditing(null)} onCreated={onCreated} /> : null}
    </div>
  );
}

/* ── Vue MOIS : grille continue 7 colonnes façon Google Calendar ─────────── */
function MonthGrid({ refDate, events, allDayItems, todayISO, colorOf, onSlot, onEvent, onMore }: {
  refDate: Date; events: Evt[]; allDayItems: AllDayItem[]; todayISO: string; colorOf: (e: Evt) => string;
  onSlot: (iso: string) => void; onEvent: (ev: Evt) => void; onMore: (d: Date) => void;
}) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const first = new Date(year, month, 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const todayY = ymd(new Date(todayISO));

  return (
    <div className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="grid grid-cols-7">
        {DAY_NAMES.map((d) => (
          <div key={d} className="border-b border-r py-1.5 text-center text-[11px] font-bold uppercase" style={{ borderColor: "var(--border-soft)", color: "var(--text-hint)" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const dy = ymd(d);
          const inMonth = d.getMonth() === month;
          const isToday = dy === todayY;
          const dayItems = [
            ...allDayItems.filter((a) => a.date.slice(0, 10) === dy).map((a) => ({ key: `a${a.href}${a.label}`, label: a.label, color: TONE[a.tone] ?? "var(--gedify-purple)", ev: null as Evt | null, time: "" })),
            ...events.filter((e) => e.start.slice(0, 10) === dy).map((e) => ({ key: e.id, label: e.title, color: colorOf(e), ev: e, time: e.allDay ? "" : new Date(e.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })),
          ];
          const shown = dayItems.slice(0, 3);
          const extra = dayItems.length - shown.length;
          return (
            <div key={dy} className="group relative min-h-[112px] border-b border-r p-1.5" style={{ borderColor: "var(--border-soft)", background: inMonth ? "var(--surface)" : "var(--bg-card-soft)" }}>
              <button type="button" onClick={() => { const dt = new Date(d); dt.setHours(9, 0, 0, 0); onSlot(dt.toISOString()); }} className="absolute inset-0" aria-label={`Créer le ${dy}`} />
              <div className="relative flex items-center justify-between">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold" style={isToday ? { background: "var(--accent)", color: "#fff" } : { color: inMonth ? "var(--text-main)" : "var(--text-hint)" }}>{d.getDate()}</span>
              </div>
              <div className="relative mt-1 space-y-0.5">
                {shown.map((it) => (
                  <button key={it.key} type="button" onClick={() => it.ev && onEvent(it.ev)} className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[10.5px] font-semibold" style={chipStyle(it.color)}>
                    {it.time ? <span className="shrink-0 opacity-80">{it.time}</span> : <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.color }} />}
                    <span className="truncate">{it.label}</span>
                  </button>
                ))}
                {extra > 0 ? (
                  <button type="button" onClick={() => onMore(d)} className="relative block w-full px-1.5 text-left text-[10.5px] font-bold" style={{ color: "var(--text-muted)" }}>+{extra} autre{extra > 1 ? "s" : ""}</button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Vues JOUR / SEMAINE : grille horaire + ligne d'heure courante ───────── */
function TimeGrid({ days, events, allDayItems, todayISO, colorOf, onSlot, onEvent, onMove }: {
  days: Date[]; events: Evt[]; allDayItems: AllDayItem[]; todayISO: string; colorOf: (e: Evt) => string;
  onSlot: (iso: string) => void; onEvent: (ev: Evt) => void; onMove: (ev: Evt, newStartISO: string) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const todayY = ymd(new Date(todayISO));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Minute courante (ligne « maintenant »), rafraîchie chaque minute.
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  useEffect(() => {
    const id = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 60_000);
    return () => clearInterval(id);
  }, []);
  // Défile jusqu'à ~7h au montage.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H; }, []);

  function handleDrop(de: React.DragEvent<HTMLDivElement>, day: Date) {
    de.preventDefault();
    let payload: { id: string; grab: number };
    try { payload = JSON.parse(de.dataTransfer.getData("text/plain")); } catch { return; }
    const ev = events.find((x) => x.id === payload.id);
    if (!ev) return;
    const colTop = de.currentTarget.getBoundingClientRect().top;
    const y = de.clientY - colTop - (payload.grab ?? 0);
    const rawMin = (y / HOUR_H) * 60;
    const snapped = Math.max(0, Math.min(24 * 60 - 15, Math.round(rawMin / 15) * 15));
    const nd = new Date(day); nd.setHours(0, 0, 0, 0); nd.setMinutes(snapped);
    onMove(ev, nd.toISOString());
  }

  return (
    <div>
      {/* En-tête jours */}
      <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, borderColor: "var(--border-soft)" }}>
        <div />
        {days.map((d) => {
          const isToday = ymd(d) === todayY;
          return (
            <div key={d.toISOString()} className="border-l py-2 text-center" style={{ borderColor: "var(--border-soft)" }}>
              <span className="text-[11px] font-bold uppercase" style={{ color: isToday ? "var(--accent)" : "var(--text-hint)" }}>{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
              <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-bold" style={isToday ? { background: "var(--accent)", color: "#fff" } : { color: "var(--text-main)" }}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Toute la journée */}
      <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, borderColor: "var(--border-soft)", background: "var(--bg-card-soft)" }}>
        <div className="py-1 pr-1 text-right text-[10px] font-semibold" style={{ color: "var(--text-hint)" }}>jour</div>
        {days.map((d) => {
          const dy = ymd(d);
          const items = [
            ...allDayItems.filter((a) => a.date.slice(0, 10) === dy).map((a) => ({ key: `a${a.href}${a.label}`, label: a.label, color: TONE[a.tone] ?? "var(--gedify-purple)", ev: null as Evt | null })),
            ...events.filter((e) => e.allDay && e.start.slice(0, 10) === dy).map((e) => ({ key: e.id, label: e.title, color: colorOf(e), ev: e as Evt | null })),
          ];
          return (
            <div key={dy} className="min-h-[28px] space-y-0.5 border-l p-1" style={{ borderColor: "var(--border-soft)" }}>
              {items.map((it) => (
                <button key={it.key} type="button" onClick={() => it.ev && onEvent(it.ev)} className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10.5px] font-semibold" style={chipStyle(it.color)}>{it.label}</button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Grille horaire */}
      <div ref={scrollRef} className="relative grid max-h-[620px] overflow-y-auto" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div>
          {hours.map((h) => (
            <div key={h} className="pr-1.5 text-right text-[10px]" style={{ height: HOUR_H, color: "var(--text-hint)" }}>{String(h).padStart(2, "0")}:00</div>
          ))}
        </div>
        {days.map((d) => {
          const dy = ymd(d);
          const isToday = dy === todayY;
          const timed = events.filter((e) => !e.allDay && e.start.slice(0, 10) === dy);
          return (
            <div key={dy} className="relative border-l" style={{ borderColor: "var(--border-soft)" }} onDragOver={(de) => { de.preventDefault(); de.dataTransfer.dropEffect = "move"; }} onDrop={(de) => handleDrop(de, d)}>
              {hours.map((h) => (
                <button key={h} type="button" onClick={() => { const dt = new Date(d); dt.setHours(h, 0, 0, 0); onSlot(dt.toISOString()); }} className="block w-full border-b transition hover:bg-[var(--accent-soft)]" style={{ height: HOUR_H, borderColor: "var(--border-soft)" }} aria-label={`Créer à ${h}:00`} />
              ))}
              {isToday ? (
                <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center" style={{ top: (nowMin / 60) * HOUR_H }}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                  <span className="h-px flex-1" style={{ background: "var(--accent)" }} />
                </div>
              ) : null}
              {timed.map((e) => {
                const s = new Date(e.start); const en = e.end ? new Date(e.end) : new Date(s.getTime() + 3600000);
                const top = (s.getHours() + s.getMinutes() / 60) * HOUR_H;
                const height = Math.max(20, ((en.getTime() - s.getTime()) / 3600000) * HOUR_H);
                return (
                  <button
                    key={e.id}
                    type="button"
                    draggable
                    onDragStart={(de) => { const grab = de.clientY - de.currentTarget.getBoundingClientRect().top; de.dataTransfer.setData("text/plain", JSON.stringify({ id: e.id, grab })); de.dataTransfer.effectAllowed = "move"; }}
                    onClick={() => onEvent(e)}
                    className="absolute left-1 right-1 cursor-grab overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] font-semibold shadow-sm active:cursor-grabbing"
                    style={{ top, height, ...chipStyle(colorOf(e)) }}
                    title="Glisser pour replanifier"
                  >
                    <span className="block truncate">{e.title}</span>
                    <span className="block truncate text-[10px] opacity-80">{s.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
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

/* ── Vue ANNÉE : 12 mini-mois, jours avec événements marqués ─────────────── */
function YearView({ refDate, events, allDayItems, onPickDay }: { refDate: Date; events: Evt[]; allDayItems: AllDayItem[]; onPickDay: (d: Date) => void }) {
  const year = refDate.getFullYear();
  const marked = new Set<string>([...events.map((e) => e.start.slice(0, 10)), ...allDayItems.map((a) => a.date.slice(0, 10))]);
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const offset = (first.getDay() + 6) % 7;
        const daysIn = new Date(year, m + 1, 0).getDate();
        return (
          <div key={m} className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
            <p className="mb-1.5 text-[12.5px] font-bold capitalize" style={{ color: "var(--text-main)" }}>{MONTH_NAMES[m]}</p>
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

/* ── Vue LISTE : événements + tâches groupés par date ────────────────────── */
function ListView({ events, allDayItems, from, to, colorOf, onEvent }: {
  events: Evt[]; allDayItems: AllDayItem[]; from: Date; to: Date; colorOf: (e: Evt) => string;
  onEvent: (ev: Evt) => void;
}) {
  type Row = { date: string; time: string; title: string; meta: string; status: string; color: string; ev: Evt | null };
  const rows: Row[] = [
    ...allDayItems.map((a) => ({ date: a.date.slice(0, 10), time: "", title: a.label, meta: "", status: a.tone === "amber" || a.tone === "rose" ? "Échéance" : "Tâche", color: TONE[a.tone] ?? "var(--gedify-purple)", ev: null as Evt | null })),
    ...events.map((e) => ({ date: e.start.slice(0, 10), time: e.allDay ? "" : new Date(e.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), title: e.title, meta: e.location?.displayName ?? "", status: "Rendez-vous", color: colorOf(e), ev: e as Evt | null })),
  ].filter((r) => { const t = new Date(r.date).getTime(); return t >= from.getTime() && t < to.getTime(); })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.time < b.time ? -1 : 1));

  const groups = new Map<string, Row[]>();
  rows.forEach((r) => { if (!groups.has(r.date)) groups.set(r.date, []); groups.get(r.date)!.push(r); });

  if (groups.size === 0) {
    return <p className="py-12 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Aucun événement sur cette période.</p>;
  }

  return (
    <div className="space-y-4 p-4">
      {[...groups.entries()].map(([date, items]) => (
        <div key={date}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>
            {new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <div className="space-y-1.5">
            {items.map((r, i) => (
              <button key={i} type="button" onClick={() => r.ev && onEvent(r.ev)} className="grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border-soft)" }}>
                <span className="text-[13px] font-extrabold" style={{ color: "var(--text-muted)" }}>{r.time || "—"}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                    <span className="truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>{r.title}</span>
                  </span>
                  {r.meta ? <span className="ml-[18px] block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{r.meta}</span> : null}
                </span>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold" style={chipStyle(r.color)}>{r.status}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
