"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Loader2, Settings2 } from "lucide-react";

/* Widget tableau de bord « Calendrier » : VRAIS événements (agenda GEDify +
   Google/Outlook/iCloud synchronisés), réglables — choix des agendas affichés
   et de l'horizon (1→30 jours). Récupère ses propres données. */

type CalendarOption = { id: string; name: string; provider: string; color: string };
type CalEvent = { id: string; title: string; start: string; end: string | null; allDay: boolean; calendarId: string | null; color: string | null; location?: { displayName?: string | null } | null };

const DAY_CHOICES = [1, 2, 3, 4, 5, 6, 7, 14, 30];
const STORAGE_KEY = "ged-dashboard-calendar-v1";

type Settings = { days: number; hidden: string[] };
const DEFAULT_SETTINGS: Settings = { days: 7, hidden: [] };

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = JSON.parse(raw) as Partial<Settings>;
    return { days: DAY_CHOICES.includes(s.days ?? 7) ? s.days! : 7, hidden: Array.isArray(s.hidden) ? s.hidden : [] };
  } catch { return DEFAULT_SETTINGS; }
}

function calKeyOf(e: CalEvent): string { return e.calendarId ?? "local"; }

function dayLabel(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export function DashboardCalendarWidget() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Restaure les réglages (après montage → pas de souci d'hydratation SSR).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings());
  }, []);

  function persist(next: Settings) {
    setSettings(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const load = useCallback(async (days: number) => {
    setLoading(true);
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + days * 86400000);
    try {
      const [calRes, evRes] = await Promise.all([
        fetch("/api/calendars", { credentials: "include", cache: "no-store" }).catch(() => null),
        fetch(`/api/calendar/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, { credentials: "include", cache: "no-store" }),
      ]);
      if (calRes?.ok) {
        const cd = (await calRes.json()) as { calendars?: CalendarOption[] };
        setCalendars(cd.calendars ?? []);
      }
      const ed = (await evRes.json()) as { events?: CalEvent[] };
      // Exclut les événements déjà passés (le filtrage temporel se fait ici,
      // dans le handler — pas pendant le rendu).
      const nowMs = Date.now() - 60_000;
      setEvents((ed.events ?? []).filter((e) => {
        const end = e.end ? new Date(e.end).getTime() : new Date(e.start).getTime();
        return end >= nowMs;
      }));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(settings.days); }, [load, settings.days]);

  const colorByCal = useMemo(() => new Map(calendars.map((c) => [c.id, c.color])), [calendars]);

  const visible = useMemo(
    () => events
      .filter((e) => !settings.hidden.includes(calKeyOf(e)))
      .sort((a, b) => (a.start < b.start ? -1 : 1)),
    [events, settings.hidden],
  );

  // Regroupe par jour.
  const groups = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of visible) {
      const d = new Date(e.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).map(([, items]) => ({ date: new Date(items[0].start), items }));
  }, [visible]);

  return (
    <section className="relative flex h-full flex-col rounded-2xl bg-white p-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <CalendarDays className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
        </span>
        <h3 className="text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>Calendrier</h3>
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-hint)" }}>{settings.days} j</span>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-label="Réglages du calendrier"
          className="ml-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)]"
          style={{ color: showSettings ? "var(--accent)" : "var(--text-muted)" }}
        >
          <Settings2 className="h-4 w-4" strokeWidth={1.85} />
        </button>
        <Link href="/calendrier" className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>Ouvrir</Link>
      </div>

      {showSettings ? (
        <div className="mb-3 rounded-xl p-3" style={{ background: "var(--bg-card-soft)" }}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Prochains jours</p>
          <div className="flex flex-wrap gap-1">
            {DAY_CHOICES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => persist({ ...settings, days: d })}
                className="h-7 min-w-7 cursor-pointer rounded-lg px-2 text-[12px] font-bold transition"
                style={settings.days === d ? { background: "var(--accent)", color: "#fff" } : { background: "var(--surface)", color: "var(--text-muted)" }}
              >
                {d}
              </button>
            ))}
          </div>
          {calendars.length > 0 ? (
            <>
              <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Agendas affichés</p>
              <div className="space-y-1">
                {calendars.map((c) => {
                  const on = !settings.hidden.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => persist({ ...settings, hidden: on ? [...settings.hidden, c.id] : settings.hidden.filter((h) => h !== c.id) })}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left text-[12.5px] transition hover:bg-[var(--surface)]"
                      style={{ color: "var(--text-main)" }}
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded" style={{ background: on ? c.color : "transparent", border: on ? "none" : "1.5px solid var(--border-strong)" }}>
                        {on ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-[12.5px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl px-3 py-6 text-center" style={{ background: "var(--bg-card-soft)" }}>
            <CalendarDays className="mx-auto h-5 w-5" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
            <p className="mt-1.5 text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun rendez-vous</p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>Rien de prévu dans les {settings.days} prochain{settings.days > 1 ? "s" : ""} jour{settings.days > 1 ? "s" : ""}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g, gi) => (
              <div key={gi}>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>{dayLabel(g.date)}</p>
                <ul className="space-y-1">
                  {g.items.map((e) => (
                    <li key={e.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5" style={{ background: "var(--bg-card-soft)" }}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color ?? colorByCal.get(calKeyOf(e)) ?? "var(--accent)" }} aria-hidden="true" />
                      <span className="w-12 shrink-0 text-[11.5px] font-bold" style={{ color: "var(--text-muted)" }}>
                        {e.allDay ? "Journée" : new Date(e.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }} title={e.title}>{e.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
