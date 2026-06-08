"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckSquare, Loader2, MapPin, Trash2, X } from "lucide-react";

type CalendarOpt = { id: string; name: string; provider: "local" | "google"; color: string; readOnly: boolean; primary?: boolean };

/* ────────────────────────────────────────────────────────────────────────
   Création d'un RENDEZ-VOUS ou d'une TÂCHE, depuis n'importe quelle source
   (document, email, contact…). Préremplissable. Rendez-vous → API agenda
   (/api/calendar/events, socle CalendarEvent) ; Tâche → API actions
   existante (/api/actions). La relation à la source est conservée.
   Options avancées (rendez-vous) : récurrence, invités, rappel, visibilité,
   Google Meet — propagées vers Google si l'agenda cible est un agenda Google.
   ──────────────────────────────────────────────────────────────────────── */

export type CalendarItemSource = {
  sourceType?: "document" | "email" | "contact" | "project" | "folder" | "manual";
  sourceId?: string | null;
  sourceLabel?: string | null;
  documentId?: number | null;
};

/** Événement du socle à modifier (mode édition). */
export type EditableEvent = {
  id: string;
  title: string;
  description?: string | null;
  start: string;
  end?: string | null;
  allDay?: boolean;
  location?: { displayName?: string | null } | null;
  recurrence?: string | null;
  participants?: { email: string; name?: string | null }[] | null;
  reminders?: { minutesBefore: number; channel?: string }[] | null;
  visibility?: "default" | "public" | "private" | null;
  conferenceUrl?: string | null;
};

const RECURRENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Ne se répète pas" },
  { value: "FREQ=DAILY", label: "Tous les jours" },
  { value: "FREQ=WEEKLY", label: "Toutes les semaines" },
  { value: "FREQ=MONTHLY", label: "Tous les mois" },
  { value: "FREQ=YEARLY", label: "Tous les ans" },
];
const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Aucun rappel" },
  { value: "0", label: "À l'heure de l'événement" },
  { value: "10", label: "10 minutes avant" },
  { value: "30", label: "30 minutes avant" },
  { value: "60", label: "1 heure avant" },
  { value: "1440", label: "1 jour avant" },
];

type Prefill = { title?: string; startISO?: string; dueISO?: string };

const inputCls = "h-9 w-full rounded-xl border px-3 text-[13px] outline-none focus:border-[var(--accent)]";

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function toDateInput(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function CreateCalendarItemModal({
  source = {},
  prefill = {},
  defaultTab = "event",
  editEvent,
  onClose,
  onCreated,
}: {
  source?: CalendarItemSource;
  prefill?: Prefill;
  defaultTab?: "event" | "task";
  /** Si fourni → mode édition d'un événement existant (PATCH + suppression). */
  editEvent?: EditableEvent;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(editEvent);
  const [tab, setTab] = useState<"event" | "task">(editEvent ? "event" : defaultTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Champs communs
  const [title, setTitle] = useState(editEvent?.title ?? prefill.title ?? "");
  const [description, setDescription] = useState(editEvent?.description ?? "");
  // Rendez-vous
  const [allDay, setAllDay] = useState(editEvent?.allDay ?? false);
  const [start, setStart] = useState(toLocalInput(editEvent?.start ?? prefill.startISO));
  const [end, setEnd] = useState(toLocalInput(editEvent?.end ?? undefined));
  const [location, setLocation] = useState(editEvent?.location?.displayName ?? "");
  // Tâche
  const [dueDate, setDueDate] = useState(toDateInput(prefill.dueISO ?? prefill.startISO));
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  // Agenda cible (local GEDify ou agenda Google connecté). Mode création uniquement.
  const [calendars, setCalendars] = useState<CalendarOpt[]>([]);
  const [calendarId, setCalendarId] = useState("local");
  // Options avancées (rendez-vous)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recurrence, setRecurrence] = useState(editEvent?.recurrence ?? "");
  const [guests, setGuests] = useState((editEvent?.participants ?? []).map((p) => p.email).join(", "));
  const [reminder, setReminder] = useState(editEvent?.reminders?.length ? String(editEvent.reminders[0].minutesBefore) : "");
  const [visibility, setVisibility] = useState<"default" | "public" | "private">(editEvent?.visibility ?? "default");
  const [addMeet, setAddMeet] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    fetch("/api/calendars", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { calendars: [] }))
      .then((d: { calendars?: CalendarOpt[] }) => {
        if (!cancelled && Array.isArray(d.calendars)) setCalendars(d.calendars.filter((c) => !c.readOnly));
      })
      .catch(() => { /* agenda local seul */ });
    return () => { cancelled = true; };
  }, [isEdit]);

  const documentIds = source.documentId ? [source.documentId] : [];

  async function save() {
    if (!title.trim()) { setError("Le titre est obligatoire."); return; }
    setBusy(true);
    setError(null);
    try {
      if (tab === "event") {
        if (!start && !allDay) { setError("Renseignez une date de début."); setBusy(false); return; }
        const startISO = allDay ? new Date(`${(start || new Date().toISOString()).slice(0, 10)}T00:00:00`).toISOString() : new Date(start).toISOString();
        const participants = guests.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((email) => ({ email }));
        const reminders = reminder ? [{ minutesBefore: Number(reminder), channel: "notification" as const }] : [];
        const payload = {
          title: title.trim(),
          description: description || null,
          start: startISO,
          end: end ? new Date(end).toISOString() : null,
          allDay,
          location: location ? { displayName: location } : null,
          recurrence: recurrence || null,
          participants,
          reminders,
          visibility,
          requestConference: addMeet, // lu par l'API pour créer un Meet (non stocké tel quel)
        };
        const res = isEdit
          ? await fetch(`/api/calendar/events/${editEvent!.id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
              body: JSON.stringify(payload),
            })
          : await fetch("/api/calendar/events", {
              method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
              body: JSON.stringify({
                ...payload,
                calendarId,
                sourceType: source.sourceType ?? "manual",
                sourceId: source.sourceId ?? null,
                sourceLabel: source.sourceLabel ?? null,
                createdAutomatically: false,
                linkedDocumentIds: documentIds,
              }),
            });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        const res = await fetch("/api/actions", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({
            title: title.trim(),
            dueDate: dueDate ? new Date(`${dueDate}T09:00:00`).toISOString() : null,
            priority,
            documentIds,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      onCreated?.();
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!editEvent) return;
    if (!window.confirm("Supprimer cet événement ?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/events/${editEvent.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onCreated?.();
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center p-2 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Créer un rendez-vous ou une tâche">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>{isEdit ? "Modifier l'événement" : "Nouveau RDV / Nouvelle tâche"}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[var(--surface-muted)]" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" strokeWidth={2} /></button>
        </div>

        {/* Onglets (masqués en édition d'un événement) */}
        {!isEdit ? (
          <div className="flex gap-1 px-4 pt-3">
            <TabBtn active={tab === "event"} onClick={() => setTab("event")} icon={CalendarClock}>Rendez-vous</TabBtn>
            <TabBtn active={tab === "task"} onClick={() => setTab("task")} icon={CheckSquare}>Tâche</TabBtn>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {source.sourceLabel ? (
            <p className="rounded-lg px-2.5 py-1.5 text-[11.5px]" style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}>
              Source : <span className="font-semibold" style={{ color: "var(--text-main)" }}>{source.sourceLabel}</span>
            </p>
          ) : null}

          <Field label="Titre">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Titre…" autoFocus />
          </Field>

          {tab === "event" ? (
            <>
              {!isEdit && calendars.length > 1 ? (
                <Field label="Agenda">
                  <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className={inputCls}>
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.provider === "google" ? " · Google" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <label className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> Toute la journée
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Début">
                  <input type={allDay ? "date" : "datetime-local"} value={allDay ? start.slice(0, 10) : start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
                </Field>
                {!allDay ? (
                  <Field label="Fin">
                    <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
                  </Field>
                ) : null}
              </div>
              <Field label="Lieu">
                <div className="flex items-center gap-1.5 rounded-xl border px-2.5" style={{ borderColor: "var(--border)" }}>
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: "var(--text-hint)" }} aria-hidden="true" />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 w-full bg-transparent text-[13px] outline-none" placeholder="Adresse ou lieu (Google Maps)…" />
                </div>
              </Field>

              <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                {showAdvanced ? "− Masquer les options" : "+ Plus d'options"}
              </button>

              {showAdvanced ? (
                <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card-soft)" }}>
                  <Field label="Récurrence">
                    <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={inputCls}>
                      {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Invités">
                    <input value={guests} onChange={(e) => setGuests(e.target.value)} className={inputCls} placeholder="Emails séparés par des virgules" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Rappel">
                      <select value={reminder} onChange={(e) => setReminder(e.target.value)} className={inputCls}>
                        {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Visibilité">
                      <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className={inputCls}>
                        <option value="default">Par défaut</option>
                        <option value="private">Privé</option>
                        <option value="public">Public</option>
                      </select>
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
                    <input type="checkbox" checked={addMeet} onChange={(e) => setAddMeet(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> Ajouter une visioconférence Google Meet
                  </label>
                  {editEvent?.conferenceUrl ? (
                    <a href={editEvent.conferenceUrl} target="_blank" rel="noreferrer" className="inline-flex text-[12px] font-bold" style={{ color: "var(--gedify-green)" }}>Rejoindre la visioconférence →</a>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Échéance">
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Priorité">
                <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className={inputCls}>
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </Field>
            </div>
          )}

          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} placeholder="Notes…" />
          </Field>

          {error ? <p className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: "var(--gedify-orange-soft)", color: "var(--text-main)" }}>{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
          {isEdit ? (
            <button type="button" onClick={() => void remove()} disabled={busy} className="mr-auto inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-semibold transition hover:bg-rose-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "#E11D48" }}>
              <Trash2 className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> Supprimer
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-xl border px-4 text-[13.5px] font-semibold transition hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Annuler</button>
          <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof CalendarClock; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold transition" style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-muted)" }}>
      <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>{label}</span>
      {children}
    </label>
  );
}
