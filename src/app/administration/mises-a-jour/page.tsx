import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Cpu, GitBranch, Package, Server } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { UpdateCheckButton } from "@/components/admin/update-check-button";
import { detectInstallation, getUpdateState } from "@/lib/admin/update-service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mises à jour — Administration" };

export default async function AdminUpdatesPage() {
  const install = detectInstallation();
  const state = await getUpdateState();
  const upToDate = !state.updateAvailable;

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[{ href: "/administration", label: "Administration" }, { label: "Mises à jour" }]}
        title="Mises à jour"
        description="Détection automatique de l'installation, version disponible et état de l'updater."
        actions={<UpdateCheckButton />}
      />

      {/* Bandeau d'état */}
      <div className="flex items-start gap-3 rounded-2xl p-4" style={upToDate
        ? { background: "var(--gedify-green-soft)", border: "1px solid var(--gedify-green)" }
        : { background: "var(--gedify-orange-soft)", border: "1px solid var(--gedify-orange)" }}>
        {upToDate
          ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--gedify-green)" }} strokeWidth={1.85} aria-hidden="true" />
          : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--gedify-orange)" }} strokeWidth={1.85} aria-hidden="true" />}
        <div>
          <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
            {upToDate ? "GEDify est à jour" : `Mise à jour disponible : ${state.latestVersion}`}
          </p>
          <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            {state.lastError
              ? `Dernière vérification en erreur : ${state.lastError}`
              : state.lastCheckedAt ? `Dernière vérification : ${formatDateTime(state.lastCheckedAt)}` : "Aucune vérification effectuée — cliquez sur « Vérifier maintenant »."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard icon={Package} title="Version">
          <Row label="Version installée" value={state.installedVersion} />
          <Row label="Dernière version disponible" value={state.latestVersion ?? "—"} />
          <Row label="Canal" value={state.releaseChannel} />
          <Row label="Compatibilité" value={state.compatibilityStatus === "ok" ? "Compatible" : state.compatibilityStatus === "incompatible" ? "Incompatible" : "Inconnue"} />
          {state.releaseNotesUrl ? (
            <a href={state.releaseNotesUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-[12.5px] font-semibold underline" style={{ color: "var(--accent)" }}>Voir les nouveautés</a>
          ) : null}
        </SectionCard>

        <SectionCard icon={Server} title="Installation détectée">
          <Row label="Type d'installation" value={install.label} icon={Server} />
          <Row label="Runtime" value={install.runtime} />
          <Row label="Stockage" value={install.storageMode} />
          <Row label="Architecture" value={install.architecture} icon={Cpu} />
          <Row label="Stratégie de mise à jour" value={install.updateStrategy} icon={GitBranch} />
          <Row label="Service updater" value={install.updaterAvailable ? "Disponible" : "Non installé"} />
        </SectionCard>
      </div>

      <SectionCard icon={GitBranch} title="Installer une mise à jour" description="L'exécution réelle est confiée au service séparé « gedify-updater ».">
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card-soft)" }}>
          {install.updaterAvailable ? (
            <p className="text-[13px]" style={{ color: "var(--text-main)" }}>
              Le service de mise à jour est détecté. L&apos;installation automatique (sauvegarde → téléchargement → recréation → migrations → vérification → rollback) sera pilotée par <code className="rounded bg-white px-1 font-mono text-[12px]">gedify-updater</code> via son API interne authentifiée.
            </p>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              Le conteneur <code className="rounded bg-white px-1 font-mono text-[12px]">gedify-updater</code> n&apos;est pas encore présent sur cette installation. Il est ajouté aux fichiers de déploiement et sera disponible après la prochaine recréation. La mise à jour automatique depuis l&apos;interface nécessite ce service (le conteneur web ne reçoit jamais l&apos;accès au socket Docker pour des raisons de sécurité).
            </p>
          )}
        </div>
      </SectionCard>
    </PageShell>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-0" style={{ borderColor: "var(--border-soft)" }}>
      <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> : null}{label}
      </span>
      <span className="text-[13px] font-bold capitalize" style={{ color: "var(--text-main)" }}>{value}</span>
    </div>
  );
}
