"use client";

import { useEffect, useState } from "react";
import { CheckSquare } from "lucide-react";
import { getHiddenCalendars, setCalendarHidden, subscribeCalendarVisibility } from "@/lib/calendar/calendar-visibility-store";
import { CalDavConnect } from "@/components/calendar/caldav-connect";

type CalendarOpt = { id: string; name: string; provider: "local" | "google" | "icloud"; color: string; readOnly: boolean; primary?: boolean };

/* Panneau « Agendas » de la sidebar : liste l'agenda local + les agendas Google
   connectés, chacun avec une case à cocher (afficher/masquer) et sa couleur.
   L'état de visibilité est partagé avec les vues temporelles via le store. */
export function CalendarAgendasPanel() {
  const [calendars, setCalendars] = useState<CalendarOpt[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(getHiddenCalendars());
    return subscribeCalendarVisibility(() => setHidden(getHiddenCalendars()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calendars", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { calendars: [] }))
      .then((d: { calendars?: CalendarOpt[] }) => {
        if (!cancelled && Array.isArray(d.calendars)) setCalendars(d.calendars);
      })
      .catch(() => { /* agenda local seul */ });
    return () => { cancelled = true; };
  }, []);

  function toggle(id: string) {
    setCalendarHidden(id, !hidden.has(id));
  }

  return (
    <div className="rounded-2xl border bg-white p-2.5" style={{ borderColor: "var(--border)" }}>
      <p className="pb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Agendas</p>
      <div className="space-y-0.5">
        {calendars.map((c) => {
          const on = !hidden.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[12px] transition hover:bg-[var(--bg-card-soft)]"
              style={{ color: "var(--text-main)" }}
              aria-pressed={on}
              title={on ? `Masquer ${c.name}` : `Afficher ${c.name}`}
            >
              <span
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border"
                style={{ background: on ? c.color : "transparent", borderColor: on ? c.color : "var(--border-strong)" }}
              >
                {on ? <span className="text-[9px] font-bold leading-none text-white">✓</span> : null}
              </span>
              <span className="min-w-0 flex-1 truncate" style={{ opacity: on ? 1 : 0.55 }}>{c.name}</span>
              {c.provider !== "local" ? <span className="shrink-0 text-[9px] font-bold uppercase" style={{ color: "var(--text-hint)" }}>{c.provider === "google" ? "G" : "iC"}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Légende des éléments non-agenda (toujours visibles). */}
      <div className="mt-2 space-y-1 border-t pt-2 text-[11.5px]" style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}>
        <span className="flex items-center gap-2"><CheckSquare className="h-3.5 w-3.5" style={{ color: "var(--gedify-info)" }} strokeWidth={1.85} /> Tâches</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--gedify-orange)" }} /> Échéances</span>
      </div>

      <CalDavConnect />
    </div>
  );
}
