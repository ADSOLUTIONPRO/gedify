"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, Loader2, ShieldCheck, Wrench } from "lucide-react";

/* Diagnostic « Cohérence des données financières » (§22). Détecte les
   incohérences (catégorie absente, payé+restant, en retard sans échéance…) via
   /api/budget/diagnostic et propose une réparation conservatrice (ambiguës →
   « À contrôler »). Lecture seule par défaut ; ne répare jamais silencieusement. */

type Anomaly = { id: string; label: string; type: string; detail: string };
type Bucket = { count: number; total: number };
type Aggregates = { income: Bucket; expense: Bucket; debt: Bucket; dueSoon: Bucket; overdue: Bucket; toReview: Bucket; netBalance: number };
type Report = { analyzed: number; anomalies: Anomaly[]; aggregates: Aggregates };

const TYPE_LABEL: Record<string, string> = {
  paid_with_remaining: "Payé mais restant dû",
  overdue_without_past_due: "En retard sans échéance passée",
  due_before_document: "Échéance avant la date du document",
  no_bucket: "Ligne active sans catégorie",
};

function eur(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function FinanceDiagnosticPanel() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repairedMsg, setRepairedMsg] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRepairedMsg(null);
    try {
      const res = await fetch("/api/budget/diagnostic", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport((await res.json()) as Report);
    } catch {
      setError("Analyse impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void analyze(); }, [analyze]);

  async function repair() {
    if (repairing) return;
    setRepairing(true);
    setError(null);
    try {
      const res = await fetch("/api/budget/diagnostic", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as { repaired: number; remainingAnomalies: number };
      setRepairedMsg(`${d.repaired} ligne(s) classée(s) « À contrôler ». ${d.remainingAnomalies} anomalie(s) restante(s).`);
      await analyze();
      router.refresh();
    } catch {
      setError("Réparation impossible.");
    } finally {
      setRepairing(false);
    }
  }

  function exportReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-finances-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const anomalies = report?.anomalies ?? [];
  const ok = report && anomalies.length === 0;

  return (
    <section className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>
          <ShieldCheck className="h-4 w-4" strokeWidth={2} style={{ color: "var(--accent)" }} /> Cohérence des données financières
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => void analyze()} disabled={loading} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Analyser
          </button>
          <button type="button" onClick={() => void repair()} disabled={repairing || anomalies.length === 0} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold transition hover:bg-amber-50 disabled:opacity-40" style={{ borderColor: "#FDE68A", color: "#B45309" }}>
            {repairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" strokeWidth={2} />} Réparer
          </button>
          <button type="button" onClick={exportReport} disabled={!report} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-slate-50 disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <Download className="h-3.5 w-3.5" strokeWidth={2} /> Exporter
          </button>
        </div>
      </div>

      {error ? <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--danger)" }}>{error}</p> : null}
      {repairedMsg ? <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--gedify-green)" }}>{repairedMsg}</p> : null}

      {report ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            <span>{report.analyzed} ligne(s) analysée(s)</span>
            <span aria-hidden="true">·</span>
            <span>Solde net : <strong style={{ color: "var(--text-main)" }}>{eur(report.aggregates.netBalance)}</strong></span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              ["Revenus", report.aggregates.income],
              ["Dépenses", report.aggregates.expense],
              ["Dettes", report.aggregates.debt],
              ["À payer bientôt", report.aggregates.dueSoon],
              ["En retard", report.aggregates.overdue],
              ["À contrôler", report.aggregates.toReview],
            ] as [string, Bucket][]).map(([label, b]) => (
              <div key={label} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border)" }}>
                <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>{label}</p>
                <p className="text-[13px] font-extrabold tabular-nums" style={{ color: "var(--text-main)" }}>{eur(b.total)}</p>
                <p className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>{b.count} ligne(s)</p>
              </div>
            ))}
          </div>

          {ok ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--gedify-green)" }}>
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> Aucune incohérence détectée.
            </p>
          ) : (
            <div className="mt-3">
              <p className="mb-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "#B45309" }}>
                <AlertTriangle className="h-4 w-4" strokeWidth={2} /> {anomalies.length} anomalie(s) détectée(s)
              </p>
              <ul className="space-y-1">
                {anomalies.slice(0, 30).map((a, i) => (
                  <li key={`${a.id}-${a.type}-${i}`} className="flex items-start justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[12px]" style={{ borderColor: "var(--border)" }}>
                    <span className="min-w-0"><strong style={{ color: "var(--text-main)" }}>{a.label || a.id}</strong> — {a.detail}</span>
                    <span className="shrink-0 text-[10.5px] font-bold" style={{ color: "var(--text-hint)" }}>{TYPE_LABEL[a.type] ?? a.type}</span>
                  </li>
                ))}
              </ul>
              {anomalies.length > 30 ? <p className="mt-1 text-[11px]" style={{ color: "var(--text-hint)" }}>… et {anomalies.length - 30} autre(s).</p> : null}
            </div>
          )}
        </>
      ) : loading ? (
        <p className="mt-3 flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyse en cours…</p>
      ) : null}
    </section>
  );
}
