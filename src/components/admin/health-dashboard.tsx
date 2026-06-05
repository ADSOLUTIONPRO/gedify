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
  FileType2,
  FileWarning,
  FolderTree,
  FolderX,
  HardDrive,
  Tags,
  Users,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlink,
  FileX,
  Lock,
  Workflow,
  Wallet,
  Copy,
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
  ocr: { ready: number; processing: number; failed: number; withoutOcr: number; low: number; avgTextLength: number; engine: string | null; language: string | null };
  classification: { total: number; withoutTag: number; withoutType: number; withoutCorrespondent: number; withoutFolder: number; needsReview: number; unusedTags: number; unusedTypes: number; emptyFolders: number; correspondentDuplicates: number };
  generatedAt: string;
};

type IntegrityReport = {
  documents: number;
  docsWithoutOriginal: number;
  orphanOriginals: number;
  docsWithoutOcr: number;
  brokenBudgetLinks: number;
  brokenMailLinks: number;
  generatedAt: string;
};

type SecurityReport = {
  status: "ok" | "warning" | "error";
  env: { authSecret: string; databaseUrl: string; storageMode: string; cookieSecure: string; openaiKey: string; connectorSecret: string };
  users: { total: number; admins: number; activeAdmins: number; noPassword: number };
  mailTokens: { total: number; expired: number; encryptionConfigured: boolean };
  warnings: string[];
  errors: string[];
  generatedAt: string;
};

type AutomationReport = {
  workflows: { total: number; enabled: number; neverRun: number; lastRunAt: string | null };
  recentActions: { at: string; user: string; action: string; target: string | null; result: "success" | "denied" | "error"; details: string | null }[];
  generatedAt: string;
};

type FinancesReport = {
  total: number;
  toReview: number;
  withoutDocument: number;
  withoutDueDate: number;
  overdue: number;
  aiCreated: number;
  validated: number;
  duplicateGroups: number;
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
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [security, setSecurity] = useState<SecurityReport | null>(null);
  const [automation, setAutomation] = useState<AutomationReport | null>(null);
  const [finances, setFinances] = useState<FinancesReport | null>(null);
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
      // Intégrité : diagnostic complémentaire (non bloquant — n'empêche pas la santé de s'afficher).
      try {
        const ir = await fetch("/api/admin/integrity", { credentials: "include", cache: "no-store" });
        const idata = (await ir.json()) as IntegrityReport | { error: string };
        if (ir.ok && !("error" in idata)) setIntegrity(idata as IntegrityReport);
      } catch {
        /* intégrité indisponible : ignorée */
      }
      // Sécurité : posture masquée (non bloquant).
      try {
        const sr = await fetch("/api/admin/security", { credentials: "include", cache: "no-store" });
        const sdata = (await sr.json()) as SecurityReport | { error: string };
        if (sr.ok && !("error" in sdata)) setSecurity(sdata as SecurityReport);
      } catch {
        /* sécurité indisponible : ignorée */
      }
      // Automatisations & actions (non bloquant).
      try {
        const ar = await fetch("/api/admin/automation", { credentials: "include", cache: "no-store" });
        const adata = (await ar.json()) as AutomationReport | { error: string };
        if (ar.ok && !("error" in adata)) setAutomation(adata as AutomationReport);
      } catch {
        /* automatisation indisponible : ignorée */
      }
      // Finances (non bloquant).
      try {
        const fr = await fetch("/api/admin/finances", { credentials: "include", cache: "no-store" });
        const fdata = (await fr.json()) as FinancesReport | { error: string };
        if (fr.ok && !("error" in fdata)) setFinances(fdata as FinancesReport);
      } catch {
        /* finances indisponibles : ignorées */
      }
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

      {/* Intégrité fichiers et liens */}
      {integrity ? (
        <SectionCard
          icon={ShieldCheck}
          title="Intégrité des fichiers et liens"
          description="Cohérence documents ↔ fichiers ↔ budget ↔ mails — diagnostic 100 % lecture seule."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Documents sans original" value={integrity.docsWithoutOriginal} helper="fichier introuvable" icon={FileWarning} tone={integrity.docsWithoutOriginal ? "rose" : "emerald"} />
            <StatCard label="Originaux orphelins" value={integrity.orphanOriginals} helper="aucun document actif" icon={FileX} tone={integrity.orphanOriginals ? "amber" : "emerald"} />
            <StatCard label="Liens budget cassés" value={integrity.brokenBudgetLinks} helper="document supprimé" icon={Unlink} tone={integrity.brokenBudgetLinks ? "rose" : "emerald"} />
            <StatCard label="Liens mail cassés" value={integrity.brokenMailLinks} helper="document supprimé" icon={Unlink} tone={integrity.brokenMailLinks ? "rose" : "emerald"} />
          </div>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Aucune modification effectuée. Détail des éléments concernés : <code>npm run gedify:integrity:inspect</code> (options <code>--missing</code> · <code>--orphans</code>). Ne supprimez jamais un document signalé « sans original » : restaurez-le depuis une sauvegarde.
          </p>
        </SectionCard>
      ) : null}

      {/* Sécurité (secrets masqués) */}
      {security ? (
        <SectionCard
          icon={Lock}
          title="Sécurité"
          description="Accès, comptes et tokens — aucun secret n'est affiché (lecture seule)."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2.5 text-sm">
              <Row label="AUTH_SECRET" value={security.env.authSecret} tone={security.env.authSecret === "présent" ? "emerald" : "rose"} />
              <Row label="DATABASE_URL" value={security.env.databaseUrl} tone={security.env.databaseUrl === "présent" ? "emerald" : "slate"} />
              <Row label="OPENAI_API_KEY" value={security.env.openaiKey} tone={security.env.openaiKey === "présent" ? "emerald" : "slate"} />
              <Row label="Chiffrement tokens mail" value={security.env.connectorSecret === "présent" ? "configuré" : "absent"} tone={security.env.connectorSecret === "présent" ? "emerald" : security.mailTokens.total ? "amber" : "slate"} />
            </div>
            <div className="space-y-2.5 text-sm">
              <Row label="Utilisateurs" value={String(security.users.total)} tone="blue" />
              <Row label="Administrateurs actifs" value={String(security.users.activeAdmins)} tone={security.users.activeAdmins ? "emerald" : "rose"} />
              <Row label="Comptes sans mot de passe" value={String(security.users.noPassword)} tone={security.users.noPassword ? "amber" : "emerald"} />
              <Row label="Tokens mail" value={`${security.mailTokens.total}${security.mailTokens.expired ? ` · ${security.mailTokens.expired} expiré(s)` : ""}`} tone={security.mailTokens.expired ? "amber" : "emerald"} />
            </div>
          </div>
          {security.errors.length || security.warnings.length ? (
            <ul className="mt-3 space-y-1 text-[12px]">
              {security.errors.map((e, i) => (
                <li key={`se-${i}`} className="font-semibold text-rose-700">❌ {e}</li>
              ))}
              {security.warnings.map((w, i) => (
                <li key={`sw-${i}`} style={{ color: "var(--text-muted)" }}>⚠️ {w}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Aucun secret affiché (présence seule). Détail en conteneur : <code>npm run gedify:security:inspect</code>.
          </p>
        </SectionCard>
      ) : null}

      {/* Automatisations & actions groupées */}
      {automation ? (
        <SectionCard
          icon={Workflow}
          title="Automatisations & actions"
          description="Règles/workflows et dernières actions groupées journalisées."
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Workflows" value={automation.workflows.total} helper="règles définies" icon={Workflow} tone="blue" />
            <StatCard label="Actifs" value={automation.workflows.enabled} helper="activés" icon={Activity} tone={automation.workflows.enabled ? "emerald" : "slate"} />
            <StatCard label="Jamais exécutés" value={automation.workflows.neverRun} helper="à tester" icon={AlertTriangle} tone={automation.workflows.neverRun ? "amber" : "emerald"} />
            <StatCard label="Dernière exécution" value={automation.workflows.lastRunAt ? new Date(automation.workflows.lastRunAt).toLocaleDateString("fr-FR") : "—"} helper="workflow" icon={RefreshCw} tone="slate" />
          </div>
          <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
            Dernières actions groupées / exécutions
          </p>
          {automation.recentActions.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune action groupée journalisée pour le moment.</p>
          ) : (
            <ul className="divide-y rounded-xl border" style={{ borderColor: "var(--border)" }}>
              {automation.recentActions.map((a, i) => (
                <li key={`act-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <StatusPill tone={a.result === "success" ? "emerald" : a.result === "denied" ? "amber" : "rose"} dot>
                      {a.action}
                    </StatusPill>
                    <span className="truncate" style={{ color: "var(--text-muted)" }}>
                      {a.target ?? ""}{a.details ? ` · ${a.details}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {a.user} · {new Date(a.at).toLocaleString("fr-FR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SanteLink href="/actions/automatiques" label="Gérer les automatisations" />
            <SanteLink href="/administration/roles" label="Journal d'audit" />
          </div>
        </SectionCard>
      ) : null}

      {/* Finances */}
      {finances ? (
        <SectionCard
          icon={Wallet}
          title="Finances"
          description="Lignes budgétaires : contrôle, échéances, doublons et provenance IA."
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Lignes budget" value={finances.total} helper="au total" icon={Wallet} tone="blue" />
            <StatCard label="À contrôler" value={finances.toReview} helper="à valider" icon={AlertTriangle} tone={finances.toReview ? "amber" : "emerald"} />
            <StatCard label="En retard" value={finances.overdue} helper="échéance dépassée" icon={Activity} tone={finances.overdue ? "rose" : "emerald"} />
            <StatCard label="Doublons possibles" value={finances.duplicateGroups} helper="groupes" icon={Copy} tone={finances.duplicateGroups ? "amber" : "emerald"} />
          </div>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <span>Sans document lié : <strong>{finances.withoutDocument}</strong></span>
            <span>Sans échéance (sorties) : <strong>{finances.withoutDueDate}</strong></span>
            <span>Créées par IA : <strong>{finances.aiCreated}</strong></span>
            <span>Validées : <strong>{finances.validated}</strong></span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SanteLink href="/finances" label="Ouvrir les finances" />
            <SanteLink href="/budget" label="Budget" />
          </div>
          <p className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Détail / doublons en conteneur : <code>npm run gedify:finances:inspect</code>.
          </p>
        </SectionCard>
      ) : null}

      {/* Classement documentaire */}
      <SectionCard icon={FolderTree} title="Classement documentaire" description="Tags, types, correspondants, dossiers — et documents à classer.">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Sans tag" value={health!.classification.withoutTag} helper="documents" icon={Tags} tone={health!.classification.withoutTag ? "amber" : "emerald"} />
          <StatCard label="Sans type" value={health!.classification.withoutType} helper="documents" icon={FileType2} tone={health!.classification.withoutType ? "amber" : "emerald"} />
          <StatCard label="Sans correspondant" value={health!.classification.withoutCorrespondent} helper="documents" icon={Users} tone={health!.classification.withoutCorrespondent ? "amber" : "emerald"} />
          <StatCard label="Sans dossier" value={health!.classification.withoutFolder} helper="non classés" icon={FolderX} tone={health!.classification.withoutFolder ? "slate" : "emerald"} />
          <StatCard label="À vérifier" value={health!.classification.needsReview} helper="suggestions" icon={Brain} tone={health!.classification.needsReview ? "amber" : "emerald"} />
        </div>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <span>Tags inutilisés : <strong>{health!.classification.unusedTags}</strong></span>
          <span>Types inutilisés : <strong>{health!.classification.unusedTypes}</strong></span>
          <span>Dossiers vides : <strong>{health!.classification.emptyFolders}</strong></span>
          <span>Correspondants doublons : <strong>{health!.classification.correspondentDuplicates}</strong></span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SanteLink href="/documents?etat=unclassified" label="Documents non classés" />
          <SanteLink href="/documents?etat=ia_review" label="À vérifier" />
          <SanteLink href="/recherche?no_correspondent=on" label="Sans correspondant" />
          <SanteLink href="/tags" label="Gérer les tags" />
          <SanteLink href="/correspondants" label="Correspondants" />
        </div>
      </SectionCard>

      {/* OCR et indexation */}
      <SectionCard icon={ScanText} title="OCR et indexation" description={`Moteur : ${health!.ocr.engine ?? "—"} · Langue : ${health!.ocr.language ?? "fra+eng"}`}>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="OCR terminés" value={health!.ocr.ready} helper="documents" icon={ScanText} tone="emerald" />
          <StatCard label="OCR en cours" value={health!.ocr.processing} helper="documents" icon={Cpu} tone={health!.ocr.processing ? "blue" : "slate"} />
          <StatCard label="OCR en erreur" value={health!.ocr.failed} helper="documents" icon={AlertTriangle} tone={health!.ocr.failed ? "rose" : "emerald"} />
          <StatCard label="Sans OCR" value={health!.ocr.withoutOcr} helper="texte vide" icon={FileWarning} tone={health!.ocr.withoutOcr ? "amber" : "emerald"} />
          <StatCard label="OCR faible" value={health!.ocr.low} helper={`moy. ${health!.ocr.avgTextLength} car.`} icon={ScanText} tone={health!.ocr.low ? "amber" : "slate"} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton onClick={() => void runPipeline("ocr-missing", "o-miss")} busy={busy === "o-miss"} disabled={Boolean(busy)} icon={ScanText} label="Relancer OCR manquants" />
          <ActionButton onClick={() => void runPipeline("retry-failed", "o-retry")} busy={busy === "o-retry"} disabled={Boolean(busy)} icon={RefreshCw} label="Relancer OCR/jobs en erreur" tone="rose" />
          <ActionButton onClick={() => void runPipeline("reindex-all", "o-idx")} busy={busy === "o-idx"} disabled={Boolean(busy)} icon={RefreshCw} label="Réindexer les documents" />
        </div>
      </SectionCard>

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

function SanteLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50"
      style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
    >
      {label}
    </Link>
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
