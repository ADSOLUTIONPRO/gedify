"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";

type ItemStatus = "pending" | "running" | "done" | "review" | "error";
type Item = { id: number; title: string; status: ItemStatus; message?: string };

type AnalyzeResponse = {
  analysis?: { needsReview?: boolean };
  applied?: { needsValidation?: string[] } | null;
  message?: string;
  error?: string;
};

/**
 * Analyse IA groupée avec progression live (façon Fiche IA, mais par lot).
 * Itère document par document sur /api/ai/analyze-document — les résultats sont
 * sauvegardés au fil de l'eau côté serveur (jamais perdus si une analyse échoue).
 * Annulation possible ; réessai des erreurs en fin de lot.
 */
export function BulkAnalyzeDialog({
  docs,
  onClose,
  onDone,
}: {
  docs: { id: number; title: string }[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const [items, setItems] = useState<Item[]>(() => docs.map((d) => ({ id: d.id, title: d.title, status: "pending" as ItemStatus })));
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  const counts = useMemo(() => ({
    total: items.length,
    done: items.filter((i) => i.status === "done").length,
    review: items.filter((i) => i.status === "review").length,
    error: items.filter((i) => i.status === "error").length,
    processed: items.filter((i) => i.status === "done" || i.status === "review" || i.status === "error").length,
  }), [items]);

  function patch(id: number, p: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }

  async function run(onlyPending: boolean) {
    setStarted(true);
    setRunning(true);
    cancelRef.current = false;
    // Snapshot des cibles à traiter.
    const targets = items.filter((it) => (onlyPending ? it.status === "pending" || it.status === "error" : true));
    for (const t of targets) {
      if (cancelRef.current) break;
      patch(t.id, { status: "running", message: undefined });
      try {
        const res = await fetch(`/api/ai/analyze-document`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: t.id, mode: "cloud", advanced: true, autoApply: true, force: true }),
        });
        const data = (await res.json().catch(() => ({}))) as AnalyzeResponse;
        if (!res.ok) {
          patch(t.id, { status: "error", message: data.message || data.error || `Erreur ${res.status}` });
        } else {
          const review = data.analysis?.needsReview === true || (data.applied?.needsValidation?.length ?? 0) > 0;
          patch(t.id, { status: review ? "review" : "done" });
        }
      } catch {
        patch(t.id, { status: "error", message: "Échec réseau" });
      }
    }
    setRunning(false);
    onDone?.();
  }

  function retryErrors() {
    setItems((prev) => prev.map((it) => (it.status === "error" ? { ...it, status: "pending", message: undefined } : it)));
    void run(true);
  }

  const pct = counts.total > 0 ? Math.round((counts.processed / counts.total) * 100) : 0;
  const finished = started && !running && counts.processed === counts.total;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Analyse IA groupée">
      <button type="button" aria-label="Fermer" onClick={running ? undefined : onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: "var(--border)", background: "#FCFAF7" }}>
          <p className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>
            <Sparkles className="h-4.5 w-4.5" style={{ color: "var(--accent)" }} strokeWidth={2} /> Analyse IA groupée
          </p>
          <button type="button" onClick={running ? undefined : onClose} disabled={running} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>
            <span>{counts.processed} / {counts.total} document(s) analysé(s)</span>
            <span>{pct} %</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--accent-soft)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded-full px-2 py-0.5" style={{ background: "#EAF8EF", color: "#15803D" }}>{counts.done} OK</span>
            <span className="rounded-full px-2 py-0.5" style={{ background: "#FFF4E5", color: "#B45309" }}>{counts.review} à vérifier</span>
            <span className="rounded-full px-2 py-0.5" style={{ background: "#FEECEC", color: "#DC2626" }}>{counts.error} erreur(s)</span>
          </div>
        </div>

        <ul className="flex-1 divide-y overflow-y-auto" style={{ borderColor: "var(--border)" }}>
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2.5 px-5 py-2 text-[12.5px]">
              <StatusIcon status={it.status} />
              <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text-main)" }} title={it.title}>{it.title}</span>
              {it.message ? <span className="shrink-0 text-[11px]" style={{ color: "#DC2626" }} title={it.message}>{it.message.slice(0, 40)}</span> : null}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
          {running ? (
            <button type="button" onClick={() => { cancelRef.current = true; }} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Annuler</button>
          ) : !started ? (
            <>
              <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-full border px-4 text-[12.5px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Fermer</button>
              <button type="button" onClick={() => void run(false)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-[12.5px] font-bold text-white" style={{ background: "var(--accent)" }}>
                <Sparkles className="h-4 w-4" strokeWidth={2} /> Analyser {counts.total} document(s)
              </button>
            </>
          ) : (
            <>
              {counts.error > 0 ? <button type="button" onClick={retryErrors} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-bold" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}><RefreshCw className="h-4 w-4" strokeWidth={2} /> Réessayer les erreurs</button> : null}
              <button type="button" onClick={onClose} className="inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-[12.5px] font-bold text-white" style={{ background: "var(--accent)" }}>
                {finished ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null} Terminé
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "running") return <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--accent)" }} />;
  if (status === "done") return <Check className="h-4 w-4 shrink-0" style={{ color: "#15803D" }} strokeWidth={2.5} />;
  if (status === "review") return <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#B45309" }} strokeWidth={2} />;
  if (status === "error") return <X className="h-4 w-4 shrink-0" style={{ color: "#DC2626" }} strokeWidth={2.5} />;
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--border)" }} />;
}
