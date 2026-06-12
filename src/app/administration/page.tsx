import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity, Bell, ChevronRight, DatabaseBackup, Download, RefreshCw, ScrollText,
  Trash2, UserCog, UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { AdminConfigPanel } from "@/components/settings/administration-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { getGedifyFeatureFlags } from "@/lib/settings/feature-flags";
import { OrphanCleanupButton } from "@/components/admin/orphan-cleanup-button";
import { ResetHistoryButton } from "@/components/admin/reset-history-button";
import { SyncDeletedButton } from "@/components/admin/sync-deleted-button";
import { ScopedResetButton } from "@/components/admin/scoped-reset-button";
import { listAudit, type AuditEntry } from "@/lib/audit/audit-store";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

const TONE: Record<string, { bg: string; color: string }> = {
  green: { bg: "var(--gedify-green-soft)", color: "var(--gedify-green)" },
  blue: { bg: "var(--gedify-info-soft)", color: "var(--gedify-info)" },
  purple: { bg: "var(--gedify-purple-soft)", color: "var(--gedify-purple)" },
  amber: { bg: "var(--gedify-orange-soft)", color: "var(--gedify-orange)" },
  rose: { bg: "#FDECEF", color: "#E11D48" },
};

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function AdministrationPage() {
  const me = await getCurrentUser();
  // En multi-tenant, un client (non-superuser) n'a PAS d'administration globale :
  // on le renvoie vers son espace Paramètres tenant-scopé.
  if (isMultiTenantEnabled() && !me?.is_superuser) redirect("/settings");

  const [flags] = await Promise.all([
    getGedifyFeatureFlags().catch(() => ({ financeSpaceEnabled: true, autoBudgetClassificationEnabled: true, autoAiAnalysisEnabled: true, autoContactSyncEnabled: true })),
  ]);
  const audit: AuditEntry[] = await listAudit(6).catch(() => [] as AuditEntry[]);

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[{ href: "/dashboard", label: "Accueil" }, { label: "Administration" }]}
        title="Tableau de bord administration"
        description="Vue d'ensemble de votre environnement GEDify."
      />

      {/* La navigation Administration est l'unique sidebar d'espace (layout) :
          le contenu occupe ici toute la largeur disponible. */}
      <div className="space-y-5">
        {/* Actions rapides — en haut, pleine largeur (4 actions). */}
        <Card icon={Activity} title="Actions rapides">
          <div className="grid grid-cols-1 gap-2.5 py-1 sm:grid-cols-2 lg:grid-cols-4">
            <Quick href="/utilisateurs" icon={UserPlus} title="Créer un utilisateur" sub="Ajouter un nouvel accès GEDify." />
            <Quick href="/administration/sauvegarde" icon={DatabaseBackup} title="Lancer une sauvegarde" sub="Créer un point de restauration." />
            <Quick href="/administration/mises-a-jour" icon={RefreshCw} title="Vérifier les mises à jour" sub="Contrôler la dernière version." />
            <Quick href="/administration/sauvegarde" icon={Download} title="Exporter les données" sub="Archive .zip complète." />
          </div>
        </Card>

        {/* Activités récentes + Maintenance (2 colonnes). */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card icon={ScrollText} title="Activités récentes" cta={{ href: "/journaux", label: "Voir tout" }}>
            {audit.length === 0 ? (
              <p className="py-3 text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune activité récente.</p>
            ) : (
              <ul>
                {audit.map((a) => (
                  <li key={a.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 border-b py-2.5 last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}>
                      <Activity className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{a.action}{a.target ? ` · ${a.target}` : ""}</span>
                      <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{a.user} · {relTime(a.at)}</span>
                    </span>
                    <ResultPill result={a.result} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div id="maintenance" className="space-y-4">
            <Card icon={UserCog} title="Maintenance des données" description="Nettoyage des données IA orphelines.">
              <div className="flex flex-col gap-4 py-1">
                <OrphanCleanupButton />
              </div>
            </Card>

            <Card icon={RefreshCw} title="Synchronisation des suppressions" description="Détecte les documents supprimés côté moteur et nettoie les données locales associées.">
              <div className="py-1"><SyncDeletedButton /></div>
            </Card>
          </div>
        </div>

        {/* Nettoyage & réinitialisation — pleine largeur (grille interne). */}
        <Card icon={Trash2} title="Nettoyage & réinitialisation" description="Historique interne, analyses IA, finances détectées, actions — réinitialisation ciblée.">
          <div className="flex flex-col gap-5 py-1">
            <ResetHistoryButton />
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2" style={{ borderColor: "var(--border-soft)" }}>
              <ScopedResetButton scope="ai" />
              <ScopedResetButton scope="finances" />
              <ScopedResetButton scope="actions" />
              <ScopedResetButton scope="all-internal" />
            </div>
          </div>
        </Card>

        {/* Configuration GEDify (intégrée depuis l'ancienne page Paramètres). */}
        <section className="space-y-3">
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Configuration GEDify</h2>
          <AdminConfigPanel initialFlags={flags} />
        </section>

        {/* Gestion des notifications (réutilise les préférences de notification). */}
        <section id="notifications" className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" strokeWidth={1.85} style={{ color: "var(--accent)" }} aria-hidden="true" />
            <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Gestion des notifications</h2>
          </div>
          <NotificationSettings />
        </section>
      </div>
    </PageShell>
  );
}

/* ── Sous-composants ── */

function Card({ icon: Icon, title, description, cta, children }: { icon: typeof Activity; title: string; description?: string; cta?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.85} style={{ color: "var(--accent)" }} aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>{title}</h3>
            {description ? <p className="truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{description}</p> : null}
          </div>
        </div>
        {cta ? <Link href={cta.href} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold" style={{ color: "var(--accent)" }}>{cta.label} <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} /></Link> : null}
      </div>
      <div className="px-4 py-2.5">{children}</div>
    </section>
  );
}

function ResultPill({ result }: { result: AuditEntry["result"] }) {
  const map = { success: TONE.green, denied: TONE.amber, error: TONE.rose } as const;
  const label = result === "success" ? "Succès" : result === "denied" ? "Refusé" : "Erreur";
  const t = map[result];
  return <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ background: t.bg, color: t.color }}>{label}</span>;
}

function Quick({ href, icon: Icon, title, sub }: { href: string; icon: typeof Activity; title: string; sub: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1.5 rounded-xl border p-3 transition hover:shadow-md" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
      </span>
      <span className="text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{title}</span>
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{sub}</span>
    </Link>
  );
}
