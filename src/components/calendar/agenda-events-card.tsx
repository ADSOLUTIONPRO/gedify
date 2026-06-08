"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, MapPin } from "lucide-react";
import { CreateCalendarItemModal, type EditableEvent } from "@/components/calendar/create-calendar-item-modal";

type ApiEvent = EditableEvent & { allDay: boolean; location: { displayName?: string | null } | null; sourceLabel: string | null };

/** Carte « Mes événements » : liste les CalendarEvent du socle (à venir),
    clic → édition (modale) avec suppression. Par utilisateur. */
export function AgendaEventsCard() {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const res = await fetch(`/api/calendar/events?from=${encodeURIComponent(from)}`, { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { events?: ApiEvent[] };
        setEvents((data.events ?? []).slice(0, 12));
      }
    } catch {
      /* hors-ligne */
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="flex items-center gap-2 py-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>;
  }
  if (events.length === 0) {
    return <p className="py-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucun rendez-vous à venir. Utilisez « Nouveau RDV / Tâche ».</p>;
  }

  return (
    <>
      <ul className="space-y-1">
        {events.map((ev) => (
          <li key={ev.id}>
            <button type="button" onClick={() => setEditing(ev)} className="flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border-soft)" }}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--gedify-purple-soft)", color: "var(--gedify-purple)" }}>
                <CalendarClock className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{ev.title}</span>
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {new Date(ev.start).toLocaleString("fr-FR", { day: "2-digit", month: "short", ...(ev.allDay ? {} : { hour: "2-digit", minute: "2-digit" }) })}
                  {ev.location?.displayName ? <><MapPin className="h-3 w-3" aria-hidden="true" /> <span className="truncate">{ev.location.displayName}</span></> : null}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {editing ? (
        <CreateCalendarItemModal
          editEvent={editing}
          onClose={() => setEditing(null)}
          onCreated={() => { setEditing(null); void load(); }}
        />
      ) : null}
    </>
  );
}
