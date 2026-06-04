"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Brain,
  Cpu,
  Database,
  DownloadCloud,
  FileWarning,
  FolderX,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ScanText,
  Sparkles,
  Trash2,
} from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type DirUsage = { files: number; bytes: number };
type GedHealth = {
  documents: {
    total: number;
    missingThumbnail: number;
    missingPreview: number;
    missingOriginal: number;
    withoutOcr: number;
    withoutFolder: number;
    aiError: number;
    jobsPending: number;
  };
  orphans: { thumbnails: number; previews: number };
  duplicates: { groups: number; exact: number; probable: number };
  storage: {
    originals: DirUsage;
    thumbnails: DirUsage;
    previews: DirUsage;
    pages: DirUsage;
    backups: DirUsage;
    totalBytes: number;
  };
  database: { mode: string; postgres: boolean; ok: boolean; detail: string | null };
  services: { openaiConfigured: boolean };
  lastBackup: { file: string; at: string } | null;
  pipeline: { pending: number; processing: number; failed: number; total: number; lastFinishedAt: string | null };
  generatedAt: string;
};

function formatBytes(n: number): string {
  if (!n) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

type BatchResult = { generated?: number; remaining?: number; deleted?: number };

export function HealthDashboard() {
  const [health, setHealth] = useState<GedHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [confirmOrphans, setConfirmOrphans] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/health", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as GedHealth | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setHealth(data as GedHealth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /** POST par lot, relancé jusqu'à épuisement (remaining=0). */
  const runBatched = useCallback(
    async (url: string, label: string) => {
      setBusy(label);
      setProgress(null);
      try {
        let total = 0;
        for (let i = 0; i < 200; i += 1) {
          const res = await fetch(url, {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "generate-missing" }),
          });
          const data = (await res.json()) as BatchResult & { error?: string };
          if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
          total += data.generated ?? 0;
          setProgress(`${total} généré(s)…`);
          if (!data.remaining || data.remaining <= 0) break;
        }
        setProgress(`✓ Terminé — ${total} généré(s).`);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const runPipeline = useCallback(
    async (action: string, label: string) => {
      setBusy(label);
      setProgress(null);
      try {
        const res = await fetch("/api/admin/pipeline", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = (await res.json()) as { queued?: number; requeued?: number; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
        const n = data.queued ?? data.requeued ?? 0;
        setProgress(`✓ ${n} job(s) ${action === "retry-failed" ? "relancé(s)" : "mis en file"}.`);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const cleanupOrphans = useCallback(async () => {
    setBusy("orphans");
    setConfirmOrphans(false);
    try {
      const res = await fetch("/api/admin/maintenance/orphans", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as BatchResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setProgress(`✓ ${data.deleted ?? 0} fichier(s) orphelin(s) supprimé(s).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(null);
    }
  }, [load]);

  const exportDiagnostic = useCallback(() => {
    if (!health) return;
    const blob = new Blob([JSON.stringify(health, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gedify-diagnostic-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [health]);

  if (loading && !health) {
    return (
      <p className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="h-4 w-4 animate-spin" /> Analyse de la GED…
      </p>
    );
  }

  if (error && !health) {
    return (
      <div className="flex items-center gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
        <button type="button" onClick={() => void load()} className="text-sm font-semibold underline">
          Réessayer
        </button>
      </div>
    );
  }

  const d = health!.documents;
  const s = health!.storage;

  return (
    <div className="flex flex-col gap-6">
      {/* Indicateurs documents */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Documents" value={d.total} helper="actifs dans la GED" icon={Database} tone="blue" />
        <StatCard label="Sans miniature" value={d.missingThumbnail} helper="à régénérer" icon={ImageIcon} tone={d.missingThumbnail ? "amber" : "emerald"} />
        <StatCard label="Sans aperçu" value={d.missingPreview} helper="à régénérer" icon={ImageIcon} tone={d.missingPreview ? "amber" : "emerald"} />
        <StatCard label="Sans OCR / texte" value={d.withoutOcr} helper="contenu vide" icon={ScanText} tone={d.withoutOcr ? "amber" : "emerald"} />
        <StatCard label="Fichiers manquants" value={d.missingOriginal} helper="original introuvable" icon={FileWarning} tone={d.missingOriginal ? "rose" : "emerald"} />
        <StatCard label="Sans dossier" value={d.withoutFolder} helper="non classés" icon={FolderX} tone={d.withoutFolder ? "slate" : "emerald"} />
        <StatCard label="IA en erreur" value={d.aiError} helper="analyse échouée" icon={Brain} tone={d.aiError ? "rose" : "emerald"} />
        <StatCard label="Jobs en attente" value={d.jobsPending} helper="traitements à finir" icon={Activity} tone={d.jobsPending ? "amber" : "emerald"} />
      </div>

      {/* Stockage + Base + Services */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard icon={HardDrive} title="Stockage fichiers" description={`Total ${formatBytes(s.totalBytes)}`}>
          <div className="space-y-2.5 text-sm">
            <Row label="Originaux" value={`${s.originals.files} · ${formatBytes(s.originals.bytes)}`} tone="blue" />
            <Row label="Miniatures" value={`${s.thumbnails.files} · ${formatBytes(s.thumbnails.bytes)}`} tone="violet" />
            <Row label="Aperçus" value={`${s.previews.files} · ${formatBytes(s.previews.bytes)}`} tone="violet" />
            <Row label="Pages PDF" value={`${s.pages.files} · ${formatBytes(s.pages.bytes)}`} tone="slate" />
            <Row label="Sauvegardes" value={`${s.backups.files} · ${formatBytes(s.backups.bytes)}`} tone="emerald" />
          </div>
        </SectionCard>

        <SectionCard icon={Database} title="Base de données" description="Mode de stockage actif">
          <div className="space-y-2.5 text-sm">
            <Row label="Mode" value={health!.database.mode} tone={health!.database.postgres ? "violet" : "blue"} />
            <Row label="PostgreSQL" value={health!.database.postgres ? (health!.database.ok ? "OK" : "Erreur") : "Inactif"} tone={!health!.database.postgres ? "slate" : health!.database.ok ? "emerald" : "rose"} />
            <Row label="Orphelins (vignettes)" value={String(health!.orphans.thumbnails)} tone={health!.orphans.thumbnails ? "amber" : "emerald"} />
            <Row label="Orphelins (aperçus)" value={String(health!.orphans.previews)} tone={health!.orphans.previews ? "amber" : "emerald"} />
            <Row label="Doublons possibles" value={`${health!.duplicates.groups} groupe(s)`} tone={health!.duplicates.groups ? "amber" : "emerald"} />
          </div>
          {health!.database.detail ? (
            <p className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>{health!.database.detail}</p>
          ) : null}
        </SectionCard>

        <SectionCard icon={Sparkles} title="Services & sauvegarde" description="État des intégrations">
          <div className="space-y-2.5 text-sm">
            <Row label="OpenAI" value={health!.services.openaiConfigured ? "Configuré" : "Absent"} tone={health!.services.openaiConfigured ? "emerald" : "slate"} />
            <Row label="Dernière sauvegarde" value={health!.lastBackup ? new Date(health!.lastBackup.at).toLocaleString("fr-FR") : "Aucune"} tone={health!.lastBackup ? "emerald" : "amber"} />
          </div>
        </SectionCard>
      </div>

      {/* Pipeline documentaire (jobs) */}
      <SectionCard icon={Cpu} title="Pipeline documentaire" description="File de traitement en arrière-plan (OCR, miniatures, aperçus, index).">
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <StatCard label="En attente" value={health!.pipeline.pending} helper="jobs" icon={Activity} tone={health!.pipeline.pending ? "amber" : "emerald"} />
          <StatCard label="En cours" value={health!.pipeline.processing} helper="jobs" icon={Cpu} tone={health!.pipeline.processing ? "blue" : "slate"} />
          <StatCard label="Échoués" value={health!.pipeline.failed} helper="jobs" icon={AlertTriangle} tone={health!.pipeline.failed ? "rose" : "emerald"} />
          <StatCard label="Total" value={health!.pipeline.total} helper="en file" icon={Database} tone="slate" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton onClick={() => void runPipeline("ocr-missing", "p-ocr")} busy={busy === "p-ocr"} disabled={Boolean(busy)} icon={ScanText} label="Relancer l'OCR manquant" />
          <ActionButton onClick={() => void runPipeline("ai-unclassified", "p-ai")} busy={busy === "p-ai"} disabled={Boolean(busy)} icon={Brain} label="Analyser les non classés (IA)" />
          <ActionButton onClick={() => void runPipeline("reindex-all", "p-index")} busy={busy === "p-index"} disabled={Boolean(busy)} icon={RefreshCw} label="Réindexer tout" />
          <ActionButton onClick={() => void runPipeline("retry-failed", "p-retry")} busy={busy === "p-retry"} disabled={Boolean(busy)} icon={RefreshCw} label="Relancer les jobs échoués" tone="rose" />
        </div>
      </SectionCard>

      {/* Actions de maintenance */}
      <SectionCard icon={RefreshCw} title="Maintenance" description="Régénération et nettoyage des fichiers dérivés.">
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton
            onClick={() => void runBatched("/api/admin/maintenance/thumbnails", "thumbnails")}
            busy={busy === "thumbnails"}
            disabled={Boolean(busy)}
            icon={ImageIcon}
            label="Régénérer miniatures manquantes"
          />
          <ActionButton
            onClick={() => void runBatched("/api/admin/maintenance/previews", "previews")}
            busy={busy === "previews"}
            disabled={Boolean(busy)}
            icon={ImageIcon}
            label="Régénérer aperçus manquants"
          />
          <ActionButton
            onClick={() => setConfirmOrphans(true)}
            busy={busy === "orphans"}
            disabled={Boolean(busy)}
            icon={Trash2}
            label="Nettoyer fichiers orphelins"
            tone="rose"
          />
          <Link
            href="/administration/sauvegarde"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--blue-600)" }}
          >
            <Database className="h-4 w-4" strokeWidth={1.75} /> Sauvegarder maintenant
          </Link>
          <button
            type="button"
            onClick={exportDiagnostic}
            className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <DownloadCloud className="h-4 w-4" strokeWidth={1.75} /> Exporter diagnostic
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={Boolean(busy)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} /> Rafraîchir
          </button>
        </div>

        {progress ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#16A34A" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-muted)" }} /> : null}
            {progress}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        ) : null}
        <p className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Dernier calcul : {new Date(health!.generatedAt).toLocaleString("fr-FR")}
        </p>
      </SectionCard>

      <ConfirmActionDialog
        isOpen={confirmOrphans}
        onClose={() => setConfirmOrphans(false)}
        onConfirm={cleanupOrphans}
        variant="warning"
        title="Nettoyer les fichiers orphelins ?"
        description="Supprime les miniatures et aperçus dont l'identifiant ne correspond plus à aucun document. Les originaux et les documents ne sont jamais touchés."
        confirmLabel="Nettoyer"
        loading={busy === "orphans"}
      />
    </div>
  );
}

function ActionButton({
  onClick,
  busy,
  disabled,
  icon: Icon,
  label,
  tone = "blue",
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  icon: typeof ImageIcon;
  label: string;
  tone?: "blue" | "rose";
}) {
  const palette =
    tone === "rose"
      ? { border: "#FCA5A5", color: "#DC2626", hover: "hover:bg-rose-50" }
      : { border: "var(--border)", color: "var(--text-main)", hover: "hover:bg-slate-50" };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold transition ${palette.hover} disabled:opacity-50`}
      style={{ borderColor: palette.border, color: palette.color }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" strokeWidth={1.75} />}
      {label}
    </button>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "blue" | "amber" | "emerald" | "violet" | "rose" | "slate" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <StatusPill tone={tone} dot>
        {value}
      </StatusPill>
    </div>
  );
}
