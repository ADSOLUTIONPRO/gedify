"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, ExternalLink, Loader2 } from "lucide-react";
import { formatDetectedDate } from "@/lib/format";

type DetectedDate = { label: string; iso: string; formatted: string };
type SavedEvent = { eventId: string; htmlLink: string | null; summary: string; start: string | null };

const RDV_LABEL = /(rendez|rdv|convocation|audience|entretien|r[ée]union|consultation)/i;

type Props = {
  documentId: number;
  docTitle: string;
  detectedDates: DetectedDate[];
};

/**
 * Carte « Rendez-vous » : affiche un RDV détecté par l'IA (date JJ-MM-YYYY +
 * heure) et permet de l'ajouter à l'agenda Google (`/api/documents/[id]/event`)
 * ou, à défaut de compte/scope, de créer un rappel lié au document.
 */
export function DocumentCalendarCard({ documentId, docTitle, detectedDates }: Props) {
  const [saved, setSaved] = useState<SavedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const rdv = detectedDates.find((d) => RDV_LABEL.test(d.label)) ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${documentId}/event`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { event: null }))
      .then((d: { event?: SavedEvent | null }) => {
        if (!cancelled) setSaved(d.event ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function addToAgenda() {
    if (!rdv || busy) return;
    setBusy(true);
    setMsg("Ajout à l'agenda…");
    try {
      const res = await fetch(`/api/documents/${documentId}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ summary: docTitle, start: rdv.iso }),
      });
      if (res.ok) {
        const { event } = (await res.json()) as { event: SavedEvent };
        setSaved(event);
        setMsg("Ajouté à l'agenda");
      } else if (res.status === 503 || res.status === 403) {
        await createReminderFallback();
      } else {
        setMsg("Ajout impossible");
      }
    } catch {
      setMsg("Ajout impossible");
    } finally {
      setBusy(false);
    }
  }

  async function createReminderFallback() {
    if (!rdv) return;
    setMsg("Agenda indisponible — création d'un rappel…");
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: docTitle, remindAt: rdv.iso, documentId, priority: "high" }),
    });
    setMsg(res.ok ? "Rappel créé (agenda non connecté)" : "Création impossible");
  }

  if (!rdv && !saved) {
    return <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucun rendez-vous détecté.</p>;
  }

  return (
    <div className="space-y-2 rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start gap-2">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={1.75} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>{saved?.summary ?? docTitle}</p>
          {rdv ? (
            <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              {rdv.label} · {formatDetectedDate(rdv.iso)}
            </p>
          ) : saved?.start ? (
            <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>{formatDetectedDate(saved.start)}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-hint)" }} aria-hidden="true" />
        ) : saved ? (
          saved.htmlLink ? (
            <a href={saved.htmlLink} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white transition hover:opacity-90" style={{ background: "#15803D" }}>
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Ouvrir l&apos;événement
            </a>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white" style={{ background: "#15803D" }}>Ajouté à l&apos;agenda</span>
          )
        ) : (
          <button type="button" onClick={() => void addToAgenda()} disabled={busy || !rdv} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-bold transition hover:bg-[#FCFAF7] disabled:opacity-50" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />}
            Ajouter à l&apos;agenda
          </button>
        )}
      </div>
      {msg ? <p className="text-[11px]" style={{ color: "var(--text-muted)" }} role="status">{msg}</p> : null}
    </div>
  );
}
