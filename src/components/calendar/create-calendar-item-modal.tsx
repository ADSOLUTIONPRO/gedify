"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckSquare, Loader2, MapPin, X } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   Création d'un RENDEZ-VOUS ou d'une TÂCHE, depuis n'importe quelle source
   (document, email, contact…). Préremplissable. Rendez-vous → API agenda
   (/api/calendar/events, socle CalendarEvent) ; Tâche → API actions
   existante (/api/actions). La relation à la source est conservée.
   Différé (phases suivantes) : invités, récurrence, Google Maps/Meet.
   ──────────────────────────────────────────────────────────────────────── */

export type CalendarItemSource = {
  sourceType?: "document" | "email" | "contact" | "project" | "folder" | "manual";
  sourceId?: string | null;
  sourceLabel?: string | null;
  documentId?: number | null;
};

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
  onClose,
  onCreated,
}: {
  source?: CalendarItemSource;
  prefill?: Prefill;
  defaultTab?: "event" | "task";
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"event" | "task">(defaultTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Champs communs
  const [title, setTitle] = useState(prefill.title ?? "");
  const [description, setDescription] = useState("");
  // Rendez-vous
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(toLocalInput(prefill.startISO));
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  // Tâche
  const [dueDate, setDueDate] = useState(toDateInput(prefill.dueISO ?? prefill.startISO));
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");

  const documentIds = source.documentId ? [source.documentId] : [];

  async function save() {
    if (!title.trim()) { setError("Le titre est obligatoire."); return; }
    setBusy(true);
    setError(null);
    try {
      if (tab === "event") {
        if (!start && !allDay) { setError("Renseignez une date de début."); setBusy(false); return; }
        const startISO = allDay ? new Date(`${(start || new Date().toISOString()).slice(0, 10)}T00:00:00`).toISOString() : new Date(start).toISOString();
        const res = await fetch("/api/calendar/events", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({
            title: title.trim(),
            description: description || null,
            start: startISO,
            end: end ? new Date(end).toISOString() : null,
            allDay,
            location: location ? { displayName: location } : null,
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

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center p-2 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Créer un rendez-vous ou une tâche">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Nouveau RDV / Nouvelle tâche</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[var(--surface-muted)]" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" strokeWidth={2} /></button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 px-4 pt-3">
          <TabBtn active={tab === "event"} onClick={() => setTab("event")} icon={CalendarClock}>Rendez-vous</TabBtn>
          <TabBtn active={tab === "task"} onClick={() => setTab("task")} icon={CheckSquare}>Tâche</TabBtn>
        </div>

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
                  <input value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 w-full bg-transparent text-[13px] outline-none" placeholder="Adresse ou lieu…" />
                </div>
              </Field>
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
