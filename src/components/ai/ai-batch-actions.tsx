"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X } from "lucide-react";

type AiBatchActionsProps = {
  /** Nombre de documents sans analyse (cible par défaut). */
  pendingCount: number;
  /** IDs des documents visibles (pour « analyser les documents visibles »). */
  visibleIds?: number[];
};

type Options = {
  reanalyze: boolean;
  createBudget: boolean;
  autoValidate: boolean;
};

/**
 * Bouton « Tout analyser » + confirmation et options. Lance l'analyse par lot
 * côté serveur (POST /api/ai/analyze-all), en préservant systématiquement les
 * corrections utilisateur. Aucune clé OpenAI n'est exposée : tout passe serveur.
 */
export function AiBatchActions({ pendingCount, visibleIds }: AiBatchActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Options>({ reanalyze: false, createBudget: true, autoValidate: false });

  const targetCount = options.reanalyze ? (visibleIds?.length ?? pendingCount) : pendingCount;

  async function launch(scope: "all" | "visible") {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        force: options.reanalyze,
        autoValidate: options.autoValidate,
        createFinancialItems: options.createBudget,
        // Lot : ne jamais bloquer sur l'OCR absent (analyse directe du document).
        allowWithoutOcr: true,
      };
      if (scope === "visible" && visibleIds && visibleIds.length > 0) {
        body.documentIds = visibleIds;
      }
      const res = await fetch("/api/ai/analyze-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { processed?: number; autoValidated?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(`${data.processed ?? 0} document(s) analysé(s)${data.autoValidated ? `, ${data.autoValidated} auto-validé(s)` : ""}.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: "var(--violet)" }}
      >
        <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Tout analyser
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => !running && setOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between">
              <h2 className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>
                Lancer l&apos;analyse IA
              </h2>
              <button type="button" onClick={() => !running && setOpen(false)} aria-label="Fermer" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Vous allez lancer l&apos;analyse IA sur <strong>{targetCount}</strong> document(s).
              Les corrections manuelles ne seront jamais écrasées.
            </p>

            <div className="mt-4 space-y-2">
              {[
                { key: "reanalyze" as const, label: "Réanalyser aussi les documents déjà analysés" },
                { key: "createBudget" as const, label: "Créer les données budget à contrôler" },
                { key: "autoValidate" as const, label: "Valider automatiquement si très fiable (confiance élevée, sans warning)" },
              ].map((opt) => (
                <label key={opt.key} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--text-main)" }}>
                  <input
                    type="checkbox"
                    checked={options[opt.key]}
                    onChange={(e) => setOptions((o) => ({ ...o, [opt.key]: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[var(--violet)]"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
              <p className="rounded-lg border px-2.5 py-1.5 text-[11.5px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                Les corrections utilisateur sont toujours préservées (option non désactivable).
              </p>
            </div>

            {error ? <p className="mt-3 text-[12.5px] font-semibold" style={{ color: "var(--danger)" }}>{error}</p> : null}
            {result ? <p className="mt-3 text-[12.5px] font-semibold" style={{ color: "var(--success)" }}>{result}</p> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              {visibleIds && visibleIds.length > 0 ? (
                <button
                  type="button"
                  disabled={running}
                  onClick={() => launch("visible")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-50"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                >
                  Documents visibles ({visibleIds.length})
                </button>
              ) : null}
              <button
                type="button"
                disabled={running || targetCount === 0}
                onClick={() => launch("all")}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--violet)" }}
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
                {running ? "Analyse en cours…" : "Lancer l'analyse"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
