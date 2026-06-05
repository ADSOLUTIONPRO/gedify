"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, CheckCircle2, Clock, Loader2, Save } from "lucide-react";
import { GedifyProgressModal } from "@/components/ui/gedify-progress-modal";
import { GedifyErrorHint } from "@/components/ui/gedify-error-hint";
import { useGedifyProgress } from "@/lib/hooks/use-gedify-progress";

type BackupEntry = { filename: string; bytes: number; createdAt: string };
type BackupReport = {
  ok: boolean;
  filename: string;
  bytes: number;
  createdAt: string;
  counts: Record<string, unknown> & { documents?: number; files?: number; postgres?: Record<string, number> };
  errors: string[];
};

function formatBytes(n: number): string {
  if (!n) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function BackupNowPanel() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<BackupReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useGedifyProgress();

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backup", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { backups?: BackupEntry[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBackups(data.backups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadList();
  }, [loadList]);

  const runBackup = useCallback(async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    progress.start({ title: "Sauvegarde", description: "Archive complète : documents, fichiers et base." });
    progress.setStep("Construction de l'archive…");
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as BackupReport & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setReport(data);
      progress.setStep(`Archive créée : ${data.filename}`);
      progress.bumpSucceeded();
      progress.finish();
      await loadList();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
      progress.fail("backup_failed", msg);
    } finally {
      setBusy(false);
    }
  }, [loadList, progress]);

  const pgTables = report?.counts?.postgres ? Object.keys(report.counts.postgres).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runBackup()}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--blue-600)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={1.75} />}
          Sauvegarder maintenant
        </button>
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Écrit une archive complète côté serveur (BACKUPS_DIR).
        </span>
      </div>

      {report ? (
        <div className="rounded-xl border p-3 text-[13px]" style={{ borderColor: "var(--border)" }}>
          <p className="flex items-center gap-1.5 font-semibold" style={{ color: "#16A34A" }}>
            <CheckCircle2 className="h-4 w-4" /> Sauvegarde créée — {report.filename} ({formatBytes(report.bytes)})
          </p>
          <ul className="mt-2 grid gap-1" style={{ color: "var(--text-muted)" }}>
            <li>Documents : <strong>{report.counts.documents ?? 0}</strong> · Fichiers : <strong>{report.counts.files ?? 0}</strong></li>
            {pgTables > 0 ? <li>PostgreSQL : <strong>{pgTables}</strong> table(s) dumpée(s)</li> : null}
            {report.errors.length > 0 ? (
              <li className="text-amber-700">{report.errors.length} avertissement(s) — {report.errors[0]}</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 text-[13px] font-semibold text-rose-700">
          <GedifyErrorHint code="backup_failed" message={error} onRetry={() => void runBackup()} />
          <span>{error}</span>
        </div>
      ) : null}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
          <Archive className="h-3.5 w-3.5" /> Sauvegardes serveur ({backups.length})
        </p>
        {backups.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucune sauvegarde serveur pour l&apos;instant.</p>
        ) : (
          <ul className="grid gap-1.5">
            {backups.slice(0, 10).map((b) => (
              <li
                key={b.filename}
                className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-[12px]"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="truncate font-medium" style={{ color: "var(--text-main)" }}>{b.filename}</span>
                <span className="flex shrink-0 items-center gap-3" style={{ color: "var(--text-muted)" }}>
                  <span>{formatBytes(b.bytes)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {new Date(b.createdAt).toLocaleString("fr-FR")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <GedifyProgressModal data={progress.data} onClose={progress.close} onRetry={() => void runBackup()} />
    </div>
  );
}
