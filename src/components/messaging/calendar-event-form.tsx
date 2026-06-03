"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, ExternalLink, Loader2, TriangleAlert, X } from "lucide-react";

type CalendarEventFormProps = {
  initialTitle?: string;
  initialDate?: string;
  initialTime?: string;
  initialLocation?: string;
  initialDescription?: string;
  initialAttendees?: string[];
  onClose: () => void;
};

type CalendarEntry = { id: string; summary: string; primary?: boolean };
type DuplicateEvent = { id: string; summary: string; htmlLink: string; start?: { dateTime?: string; date?: string } };

function toDateTimeLocal(date: string, time: string): string {
  if (!date) return "";
  const d = date.includes("T") ? date.slice(0, 10) : date;
  return `${d}T${time || "09:00"}`;
}

export function CalendarEventForm({
  initialTitle = "",
  initialDate = "",
  initialTime = "",
  initialLocation = "",
  initialDescription = "",
  initialAttendees = [],
  onClose,
}: CalendarEventFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate.includes("T") ? initialDate.slice(0, 10) : initialDate);
  const [startTime, setStartTime] = useState(initialTime || "09:00");
  const [duration, setDuration] = useState(60); // minutes
  const [location, setLocation] = useState(initialLocation);
  const [description, setDescription] = useState(initialDescription);
  const [attendees, setAttendees] = useState(initialAttendees.join(", "));
  const [calendarId, setCalendarId] = useState("primary");
  const [calendars, setCalendars] = useState<CalendarEntry[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [status, setStatus] = useState<"idle" | "checking" | "creating" | "created" | "scope_missing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateEvent[]>([]);
  const [forceCreate, setForceCreate] = useState(false);

  useEffect(() => {
    fetch("/api/messaging/calendar/events", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; calendars?: CalendarEntry[]; errorType?: string }) => {
        if (d.ok && Array.isArray(d.calendars)) {
          setCalendars(d.calendars);
          const primary = d.calendars.find((c) => c.primary);
          if (primary) setCalendarId(primary.id);
        }
        if (d.errorType === "calendar_scope") setStatus("scope_missing");
      })
      .catch(() => {})
      .finally(() => setLoadingCalendars(false));
  }, []);

  function buildEndDateTime(): string {
    const start = new Date(`${date}T${startTime}`);
    start.setMinutes(start.getMinutes() + duration);
    return start.toISOString().slice(0, 16);
  }

  async function submit(force = false) {
    if (!title || !date) return;
    setStatus(force ? "creating" : "checking");
    setError(null);
    setDuplicates([]);

    const startDT = toDateTimeLocal(date, startTime);
    const endDT = buildEndDateTime();
    const attendeeList = attendees
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    try {
      const res = await fetch("/api/messaging/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          calendarId,
          event: {
            summary: title,
            description: description || undefined,
            location: location || undefined,
            start: { dateTime: `${startDT}:00`, timeZone: "Europe/Paris" },
            end: { dateTime: `${endDT}:00`, timeZone: "Europe/Paris" },
            attendees: attendeeList.length ? attendeeList : undefined,
            reminders: { useDefault: true },
          },
          checkDuplicates: !force,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        event?: { htmlLink?: string };
        duplicates?: DuplicateEvent[];
        message?: string;
        errorType?: string;
        error?: string;
      };

      if (data.errorType === "calendar_scope") {
        setStatus("scope_missing");
        setError(data.error ?? "Scope Calendar manquant.");
        return;
      }

      if (data.duplicates && data.duplicates.length > 0) {
        setDuplicates(data.duplicates);
        setForceCreate(true);
        setStatus("idle");
        return;
      }

      if (data.ok && data.event?.htmlLink) {
        setCreatedLink(data.event.htmlLink);
        setStatus("created");
      } else {
        setStatus("error");
        setError(data.error ?? "Erreur inconnue");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Erreur réseau");
    }
  }

  if (status === "created") {
    return (
      <div className="rounded-xl border bg-white p-5 text-center" style={{ borderColor: "var(--border)" }}>
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-600" strokeWidth={1.75} />
        <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
          Événement ajouté à Google Agenda
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {createdLink && (
            <a
              href={createdLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--blue-600)" }}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
              Voir dans Google Agenda
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-2 text-[13px] font-semibold transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" style={{ color: "var(--blue-600)" }} strokeWidth={1.75} />
          <h3 className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
            Ajouter à Google Agenda
          </h3>
        </div>
        <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100" style={{ color: "var(--text-muted)" }}>
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {status === "scope_missing" && (
        <div className="mb-4 rounded-xl border p-3 text-[12px]" style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#92400E" }}>
          <strong>Scope Google Calendar manquant.</strong> Ajoutez{" "}
          <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">https://www.googleapis.com/auth/calendar.events</code>{" "}
          dans <code className="font-mono text-[11px]">GOOGLE_GMAIL_SCOPES</code> dans votre{" "}
          <code className="font-mono text-[11px]">.env.local</code>{" "}
          puis reconnectez-vous via <a href="/messagerie/parametres" className="underline">Messagerie &gt; Paramètres</a>.
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="mb-4 rounded-xl border p-3 text-[12px]" style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#92400E" }}>
          <div className="flex items-center gap-1.5 font-bold">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {duplicates.length} événement(s) similaire(s) détecté(s) pour cette date :
          </div>
          <ul className="mt-1.5 space-y-1">
            {duplicates.map((dup) => (
              <li key={dup.id}>
                <a href={dup.htmlLink} target="_blank" rel="noreferrer" className="underline">
                  {dup.summary}
                </a>
                {" — "}
                {dup.start?.dateTime
                  ? new Date(dup.start.dateTime).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                  : dup.start?.date}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void submit(true)}
              className="rounded-lg border px-3 py-1 text-[12px] font-bold transition hover:bg-amber-100"
              style={{ borderColor: "#FDE68A", color: "#92400E" }}
            >
              Créer quand même
            </button>
            <button
              type="button"
              onClick={() => { setDuplicates([]); setForceCreate(false); }}
              className="rounded-lg border px-3 py-1 text-[12px] font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Titre *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 w-full rounded-lg border px-3 text-[13px] outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-full rounded-lg border px-3 text-[13px] outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Heure</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9 w-full rounded-lg border px-3 text-[13px] outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Durée (min)</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-9 w-full rounded-lg border px-2 text-[13px] outline-none focus:ring-2" style={{ borderColor: "var(--border)" }}>
              {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Lieu</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 w-full rounded-lg border px-3 text-[13px] outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} placeholder="Adresse, lien visio…" />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Participants (emails séparés par des virgules)</label>
          <input type="text" value={attendees} onChange={(e) => setAttendees(e.target.value)} className="h-9 w-full rounded-lg border px-3 text-[13px] outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} placeholder="email1@ex.com, email2@ex.com" />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none focus:ring-2 resize-none" style={{ borderColor: "var(--border)" }} />
        </div>
        {!loadingCalendars && calendars.length > 1 && (
          <div>
            <label className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Agenda cible</label>
            <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className="h-9 w-full rounded-lg border px-2 text-[13px] outline-none focus:ring-2" style={{ borderColor: "var(--border)" }}>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>{c.summary}{c.primary ? " (principal)" : ""}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && status === "error" && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-rose-700">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-[13px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Annuler
        </button>
        <button
          type="button"
          disabled={!title || !date || status === "checking" || status === "creating" || status === "scope_missing"}
          onClick={() => void submit(forceCreate)}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--blue-600)" }}
        >
          {(status === "checking" || status === "creating") && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "scope_missing" ? "Non disponible" : "Ajouter à l'agenda"}
        </button>
      </div>
    </div>
  );
}
