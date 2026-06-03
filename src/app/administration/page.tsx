import Link from "next/link";
import {
  Activity,
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  Gauge,
  KeyRound,
  Mail,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  UsersRound,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { OrphanCleanupButton } from "@/components/admin/orphan-cleanup-button";
import { PermisTagCleanupButton } from "@/components/admin/permis-tag-cleanup-button";
import { ResetHistoryButton } from "@/components/admin/reset-history-button";
import { SyncDeletedButton } from "@/components/admin/sync-deleted-button";
import { ScopedResetButton } from "@/components/admin/scoped-reset-button";
import { getPaperlessPublicUrl, getPaperlessStatus } from "@/lib/paperless";

export const dynamic = "force-dynamic";

const ADMIN_TABS = [
  { href: "/administration", label: "Vue d'ensemble", matchPath: "/administration" },
  { href: "/utilisateurs", label: "Utilisateurs" },
  { href: "/groupes", label: "Groupes" },
  { href: "/tokens", label: "Tokens" },
  { href: "/workflows", label: "Workflows" },
  { href: "/emails", label: "Emails" },
  { href: "/journaux", label: "Journaux" },
  { href: "/statut", label: "Santé système" },
  { href: "/parametres", label: "Paramètres" },
];

const ENGINES = [
  { name: "Moteur OCR (local)", description: "OCR par défaut", tone: "blue" as const, icon: Database },
  { name: "OpenAI", description: "Analyse documentaire IA", tone: "violet" as const, icon: Bot },
  { name: "Mailbox", description: "Connecteurs email", tone: "emerald" as const, icon: Mail },
  { name: "Webhooks", description: "Notifications sortantes", tone: "amber" as const, icon: Workflow },
];

const SECURITY_CHECKS = [
  "Token Gedify conservé côté serveur",
  "Chiffrement TLS de la communication",
  "Pas d'accès anonymes",
  "Auth Gedify requise",
  "Logs d'activité tracés",
];

export default async function AdministrationPage() {
  const status = await getPaperlessStatus();
  const paperlessUrl = getPaperlessPublicUrl();

  const statistics = status.statistics ?? null;
  const userInfo = status.user ?? null;
  const auditTrails = [
    { label: "Connexion au moteur", status: status.connected ? "OK" : "Erreur", tone: status.connected ? "emerald" : "rose" },
    { label: "Version API", status: status.apiVersion ?? "—", tone: "blue" },
    { label: "Statistiques", status: statistics ? "Synchronisées" : "—", tone: statistics ? "emerald" : "slate" },
    { label: "Mise à jour", status: status.updateAvailable ? "Disponible" : "À jour", tone: status.updateAvailable ? "amber" : "emerald" },
  ] as const;

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { label: "Administration" },
        ]}
        title="Administration"
        description="Gérez les utilisateurs, les rôles et la configuration de votre plateforme."
        actions={
          paperlessUrl ? (
            <a
              href={paperlessUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Ouvrir Gedify
            </a>
          ) : null
        }
      />

      <div className="overflow-x-auto pb-1">
        <SegmentedTabs tabs={ADMIN_TABS} activeHref="/administration" />
      </div>

      {/* Row 1: 4 wide stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Compte & sécurité"
          value={userInfo ? "Connecté" : "Anonyme"}
          helper={userInfo ? `${userInfo.first_name ?? ""} ${userInfo.last_name ?? ""}`.trim() || userInfo.email || "—" : "Configurez votre profil"}
          icon={ShieldCheck}
          tone="blue"
        />
        <StatCard
          label="Utilisateurs"
          value={1}
          helper="comptes connectés à la GED"
          icon={UserCog}
          tone="emerald"
        />
        <StatCard
          label="Groupes"
          value={1}
          helper="groupes configurés"
          icon={UsersRound}
          tone="violet"
        />
        <StatCard
          label="Tokens API"
          value={status.connected ? 1 : 0}
          helper="actifs côté serveur"
          icon={KeyRound}
          tone="amber"
        />
      </div>

      {/* Row 2: 3 wide cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          icon={ShieldCheck}
          title="API protégée"
          description="Toutes les routes /api sont relayées côté serveur."
        >
          <ul className="space-y-2 text-sm" style={{ color: "var(--text-main)" }}>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" style={{ color: "#16A34A" }} strokeWidth={2} />
              Token Gedify côté serveur uniquement
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" style={{ color: "#16A34A" }} strokeWidth={2} />
              Pas d&apos;exposition de OPENAI_API_KEY au client
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" style={{ color: "#16A34A" }} strokeWidth={2} />
              Routes proxy avec authentification serveur
            </li>
          </ul>
          <Link
            href="/statut"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--blue-600)" }}
          >
            Voir le statut
            <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          </Link>
        </SectionCard>

        <SectionCard
          icon={ScrollText}
          title="Journaux d'audit"
          description="Derniers contrôles de connexion."
        >
          <ul className="space-y-2.5 text-sm">
            {auditTrails.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                <StatusPill tone={row.tone} dot>
                  {row.status}
                </StatusPill>
              </li>
            ))}
          </ul>
          <Link
            href="/journaux"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            Tous les journaux
            <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          </Link>
        </SectionCard>

        <SectionCard
          icon={Server}
          title="Santé du système"
          description="État Gedify en direct."
        >
          <div className="space-y-3 text-sm">
            <Row label="Connexion" value={status.connected ? "OK" : "Erreur"} tone={status.connected ? "emerald" : "rose"} />
            <Row label="Version" value={status.version ?? "—"} tone="blue" />
            <Row label="API" value={status.apiVersion ?? "—"} tone="slate" />
            <Row
              label="Documents"
              value={statistics?.documents_total != null ? String(statistics.documents_total) : "—"}
              tone="violet"
            />
            <Row
              label="Inbox"
              value={statistics?.documents_inbox != null ? String(statistics.documents_inbox) : "—"}
              tone={statistics?.documents_inbox && statistics.documents_inbox > 0 ? "amber" : "slate"}
            />
            <Row
              label="ASN courant"
              value={statistics?.current_asn != null ? String(statistics.current_asn) : "—"}
              tone="blue"
            />
          </div>
        </SectionCard>
      </div>

      {/* Row 3: Engines + Security */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={Sparkles}
          title="Moteurs d'extraction"
          description="Pipelines connectés à votre GED."
        >
          <div className="grid grid-cols-2 gap-3">
            {ENGINES.map((engine) => {
              const Icon = engine.icon;
              const PALETTE: Record<typeof engine.tone, { bg: string; color: string }> = {
                blue: { bg: "rgba(11,92,255,0.08)", color: "var(--blue-600)" },
                violet: { bg: "rgba(124,58,237,0.10)", color: "#7C3AED" },
                emerald: { bg: "rgba(16,163,74,0.08)", color: "#16A34A" },
                amber: { bg: "rgba(245,158,11,0.12)", color: "#B45309" },
              };
              const p = PALETTE[engine.tone];
              return (
                <div
                  key={engine.name}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{ background: p.bg, border: `1px solid ${p.color}33` }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "white" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: p.color }} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                      {engine.name}
                    </p>
                    <p
                      className="text-[11px] leading-snug"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {engine.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          icon={ShieldCheck}
          title="Sécurité"
          description="Garanties de la couche serveur."
        >
          <ul className="space-y-2 text-sm">
            {SECURITY_CHECKS.map((check) => (
              <li
                key={check}
                className="flex items-center gap-2"
                style={{ color: "var(--text-main)" }}
              >
                <CheckCircle2 className="h-4 w-4" style={{ color: "#16A34A" }} strokeWidth={2} />
                {check}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Sauvegarde & migration */}
      <SectionCard
        icon={Database}
        title="Sauvegarde & migration"
        description="Importez une archive .zip Gedify, ou exportez toutes vos données."
      >
        <Link
          href="/administration/sauvegarde"
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--blue-600)" }}
        >
          <Database className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Ouvrir Sauvegarde & migration
        </Link>
      </SectionCard>

      {/* Maintenance */}
      <SectionCard
        icon={Database}
        title="Maintenance des données"
        description="Nettoyage des données IA orphelines non liées à un document existant."
      >
        <div className="flex flex-col gap-4">
          <OrphanCleanupButton />
          <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <PermisTagCleanupButton />
          </div>
        </div>
      </SectionCard>

      {/* Synchronisation suppressions Gedify */}
      <SectionCard
        icon={RefreshCw}
        title="Synchronisation des suppressions Gedify"
        description="Détecte les documents supprimés côté Gedify et nettoie automatiquement les données locales associées."
      >
        <SyncDeletedButton />
      </SectionCard>

      {/* Reset historique interne GED (rapide) */}
      <SectionCard
        icon={Trash2}
        title="Nettoyage de l'historique GED"
        description="Supprime l'historique interne de la surcouche : analyses IA, suggestions, infos détectées et brouillons non validés."
      >
        <ResetHistoryButton />
      </SectionCard>

      {/* Réinitialisation scopée */}
      <SectionCard
        icon={RotateCcw}
        title="Réinitialisation ciblée"
        description="Réinitialisez sélectivement l'historique IA, les finances détectées, les actions ou l'intégralité de la surcouche interne."
      >
        <div className="flex flex-col gap-5">
          <ScopedResetButton scope="ai" />
          <ScopedResetButton scope="finances" />
          <ScopedResetButton scope="actions" />
          <ScopedResetButton scope="all-internal" />
        </div>
      </SectionCard>

      {/* Bottom: shortcuts */}
      <SectionCard
        icon={Settings}
        title="Raccourcis administration"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Shortcut href="/utilisateurs" icon={UserCog} label="Utilisateurs" tone="blue" />
          <Shortcut href="/groupes" icon={UsersRound} label="Groupes" tone="violet" />
          <Shortcut href="/tokens" icon={KeyRound} label="Tokens API" tone="amber" />
          <Shortcut href="/workflows" icon={Workflow} label="Workflows" tone="emerald" />
          <Shortcut href="/emails" icon={Mail} label="Emails" tone="blue" />
          <Shortcut href="/journaux" icon={ScrollText} label="Journaux" tone="amber" />
          <Shortcut href="/activite" icon={Activity} label="Activité" tone="rose" />
          <Shortcut href="/statut" icon={Gauge} label="Statut" tone="emerald" />
        </div>
      </SectionCard>
    </PageShell>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "amber" | "emerald" | "violet" | "rose" | "slate";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <StatusPill tone={tone} dot>
        {value}
      </StatusPill>
    </div>
  );
}

function Shortcut({
  href,
  icon: Icon,
  label,
  tone,
}: {
  href: string;
  icon: typeof Settings;
  label: string;
  tone: "blue" | "violet" | "emerald" | "amber" | "rose";
}) {
  const PALETTE: Record<typeof tone, { bg: string; color: string }> = {
    blue: { bg: "rgba(11,92,255,0.08)", color: "var(--blue-600)" },
    violet: { bg: "rgba(124,58,237,0.10)", color: "#7C3AED" },
    emerald: { bg: "rgba(16,163,74,0.08)", color: "#16A34A" },
    amber: { bg: "rgba(245,158,11,0.12)", color: "#B45309" },
    rose: { bg: "rgba(239,68,68,0.10)", color: "#DC2626" },
  };
  const p = PALETTE[tone];
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border bg-white p-3 transition hover:shadow-md"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: p.bg }}
      >
        <Icon className="h-4 w-4" style={{ color: p.color }} strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
          {label}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Ouvrir →
        </p>
      </div>
    </Link>
  );
}

