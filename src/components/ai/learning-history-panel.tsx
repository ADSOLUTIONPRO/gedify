"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Brain, Loader2 } from "lucide-react";

type Evt = { id: string; documentId: number; field: string; aiValue: string | null; validatedValue: string | null; wasCorrected: boolean; source: string; user: string | null; createdAt: string };
type Stats = { total: number; corrected: number; byField: Record<string, { total: number; corrected: number }> };

const FIELD_LABEL: Record<string, string> = { documentType: "Type", correspondent: "Correspondant", tags: "Tags", folder: "Dossier", date: "Date", dueDate: "Échéance", summary: "Résumé", title: "Titre" };

/** Historique d'apprentissage : valeurs IA proposées vs validées par champ. */
export function LearningHistoryPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);
  const [correctedOnly, setCorrectedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        fetch("/api/ai/learning-history?stats=1", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : { stats: null })),
        fetch(`/api/ai/learning-history?limit=40${correctedOnly ? "&corrected=1" : ""}`, { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : { events: [] })),
      ]);
      setStats(s.stats ?? null);
      setEvents(e.events ?? []);
    } catch { /* hors-ligne */ } finally { setLoading(false); }
  }, [correctedOnly]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>
          <Brain className="h-4 w-4" style={{ color: "var(--accent)" }} strokeWidth={1.85} aria-hidden="true" /> Historique d&apos;apprentissage
        </h2>
        <label className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
          <input type="checkbox" checked={correctedOnly} onChange={(e) => setCorrectedOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" /> Corrections seulement
        </label>
      </div>

      {stats ? (
        <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
          <span className="rounded-lg px-2.5 py-1 font-semibold" style={{ background: "var(--bg-card-soft)", color: "var(--text-main)" }}>{stats.total} validations</span>
          <span className="rounded-lg px-2.5 py-1 font-semibold" style={{ background: "var(--gedify-orange-soft)", color: "var(--gedify-orange)" }}>{stats.corrected} corrections IA</span>
          {Object.entries(stats.byField).map(([f, v]) => (
            <span key={f} className="rounded-lg px-2.5 py-1" style={{ background: "var(--surface-muted)", color: "var(--text-muted)" }}>{FIELD_LABEL[f] ?? f} : {v.corrected}/{v.total}</span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-[12.5px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : events.length === 0 ? (
        <p className="py-4 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucune validation enregistrée pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-1">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: ev.wasCorrected ? "var(--gedify-orange-soft)" : "var(--bg-card-soft)" }}>
              <span className="w-24 shrink-0 text-[11px] font-bold uppercase" style={{ color: "var(--text-hint)" }}>{FIELD_LABEL[ev.field] ?? ev.field}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px]">
                <span className="truncate line-through" style={{ color: "var(--text-muted)" }}>{ev.aiValue || "—"}</span>
                <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--text-hint)" }} aria-hidden="true" />
                <span className="truncate font-bold" style={{ color: "var(--text-main)" }}>{ev.validatedValue || "(vidé)"}</span>
              </span>
              <span className="shrink-0 text-[10.5px]" style={{ color: "var(--text-hint)" }}>doc #{ev.documentId}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
