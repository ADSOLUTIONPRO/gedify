import Link from "next/link";
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, Database, DatabaseBackup,
  Download, HardDrive, HeartPulse, RefreshCw, ScrollText, ShieldCheck, Trash2,
  UserCog, UserPlus, Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { OrphanCleanupButton } from "@/components/admin/orphan-cleanup-button";
import { PermisTagCleanupButton } from "@/components/admin/permis-tag-cleanup-button";
import { ResetHistoryButton } from "@/components/admin/reset-history-button";
import { SyncDeletedButton } from "@/components/admin/sync-deleted-button";
import { ScopedResetButton } from "@/components/admin/scoped-reset-button";
import { getPaperlessStatus } from "@/lib/paperless";
import { listUsers } from "@/lib/engine/users";
import { listAudit, type AuditEntry } from "@/lib/audit/audit-store";
import { pgStorageActive, sqliteActive } from "@/lib/db/pg-store";
import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";

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
  const [status, users, audit, gmailAccounts] = await Promise.all([
    getPaperlessStatus().catch(() => ({ connected: false } as Awaited<ReturnType<typeof getPaperlessStatus>>)),
    listUsers().catch(() => []),
    listAudit(6).catch(() => [] as AuditEntry[]),
    listGmailAccounts().catch(() => []),
  ]);
  const stats = status.statistics ?? null;
  const backend = sqliteActive() ? "SQLite" : pgStorageActive() ? "PostgreSQL" : "JSON local";
  const activeUsers = users.filter((u) => u.is_active !== false).length;
  const aiOn = Boolean(process.env.OLLAMA_BASE_URL || process.env.OPENAI_API_KEY || process.env.AI_CLOUD_BASE_URL);
  const docsTotal = stats?.documents_total ?? null;

  const services = [
    { label: "Base de données", sub: backend, on: true },
    { label: "Connecteur email", sub: gmailAccounts.length ? `${gmailAccounts.length} compte(s)` : "Non connecté", on: gmailAccounts.length > 0 },
    { label: "OCR local", sub: "Disponible", on: true },
    { label: "Analyse IA", sub: aiOn ? "Configurée" : "Non configurée", on: aiOn },
    { label: "Sauvegarde", sub: "Planifiable", on: true },
  ];

  const alert = !status.connected
    ? { tone: "rose" as const, title: "Moteur documentaire injoignable", sub: "Vérifiez la configuration du backend." }
    : status.updateAvailable
    ? { tone: "amber" as const, title: "Mise à jour disponible", sub: "Une nouvelle version peut être installée." }
    : { tone: "green" as const, title: "Aucune alerte critique", sub: "Votre système fonctionne normalement." };

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[{ href: "/dashboard", label: "Accueil" }, { label: "Administration" }]}
        title="Tableau de bord administration"
        description="Vue d'ensemble de votre environnement GEDify."
      />

      {/* La navigation Administration est l'unique sidebar d'espace (layout) :
          le contenu occupe ici toute la largeur disponible. */}
      <div className="space-y-4">
          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Activity} tone={status.connected ? "green" : "rose"} label="Statut global" value={status.connected ? "En bonne santé" : "Dégradé"} />
            <Stat icon={Users} tone="purple" label="Utilisateurs" value={String(users.length)} helper={`${activeUsers} actif(s)`} />
            <Stat icon={HardDrive} tone="blue" label="Base de données" value={backend} helper={docsTotal != null ? `${docsTotal} document(s)` : undefined} />
            <Stat icon={RefreshCw} tone={status.updateAvailable ? "amber" : "green"} label="Mises à jour" value={status.updateAvailable ? "Disponible" : "À jour"} />
          </div>

          {/* Dashboard cards */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Activités récentes */}
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

            {/* Santé & ressources */}
            <Card icon={HeartPulse} title="Santé & ressources">
              <div className="space-y-2.5 py-1">
                <InfoRow label="Connexion moteur" value={status.connected ? "OK" : "Erreur"} tone={status.connected ? "green" : "rose"} />
                <InfoRow label="Version" value={status.version ?? "—"} tone="blue" />
                <InfoRow label="API" value={status.apiVersion ?? "—"} tone="blue" />
                <InfoRow label="Base de données" value={backend} tone="purple" />
                <InfoRow label="Documents" value={docsTotal != null ? String(docsTotal) : "—"} tone="blue" />
                <InfoRow label="À traiter (inbox)" value={stats?.documents_inbox != null ? String(stats.documents_inbox) : "—"} tone={stats?.documents_inbox ? "amber" : "green"} />
              </div>
            </Card>

            {/* Alertes système */}
            <Card icon={ShieldCheck} title="Alertes système">
              <div className="flex items-center gap-3 py-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: TONE[alert.tone].bg, color: TONE[alert.tone].color }}>
                  {alert.tone === "green" ? <CheckCircle2 className="h-5 w-5" strokeWidth={2} /> : <AlertTriangle className="h-5 w-5" strokeWidth={2} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{alert.title}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{alert.sub}</p>
                </div>
              </div>
            </Card>

            {/* Services connectés */}
            <Card icon={Database} title="Services connectés" cta={{ href: "/messagerie/parametres-emails", label: "Gérer" }}>
              <div className="grid grid-cols-2 gap-2 py-1 sm:grid-cols-3">
                {services.map((s) => (
                  <div key={s.label} className="relative rounded-xl border p-2.5 text-center" style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}>
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full" style={{ background: s.on ? "var(--gedify-green)" : "var(--text-hint)", boxShadow: s.on ? "0 0 0 3px var(--gedify-green-soft)" : "none" }} />
                    <p className="text-[12px] font-bold" style={{ color: "var(--text-main)" }}>{s.label}</p>
                    <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--text-muted)" }}>{s.sub}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Actions rapides */}
            <Card icon={Activity} title="Actions rapides" wide>
              <div className="grid grid-cols-1 gap-2.5 py-1 sm:grid-cols-2 lg:grid-cols-4">
                <Quick href="/utilisateurs" icon={UserPlus} title="Créer un utilisateur" sub="Ajouter un nouvel accès GEDify." />
                <Quick href="/administration/sauvegarde" icon={DatabaseBackup} title="Lancer une sauvegarde" sub="Créer un point de restauration." />
                <Quick href="/administration/mises-a-jour" icon={RefreshCw} title="Vérifier les mises à jour" sub="Contrôler la dernière version." />
                <Quick href="/administration/sauvegarde" icon={Download} title="Exporter les données" sub="Archive .zip complète." />
              </div>
            </Card>
          </div>

          {/* Outils de maintenance (fonctionnels) */}
          <div id="maintenance" className="space-y-4">
            <Card icon={UserCog} title="Maintenance des données" description="Nettoyage des données IA orphelines + correction des tags de permis.">
              <div className="flex flex-col gap-4 py-1">
                <OrphanCleanupButton />
                <div className="border-t pt-4" style={{ borderColor: "var(--border-soft)" }}>
                  <PermisTagCleanupButton />
                </div>
              </div>
            </Card>

            <Card icon={RefreshCw} title="Synchronisation des suppressions" description="Détecte les documents supprimés côté moteur et nettoie les données locales associées.">
              <div className="py-1"><SyncDeletedButton /></div>
            </Card>

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
          </div>
        </div>
    </PageShell>
  );
}

/* ── Sous-composants ── */

function Stat({ icon: Icon, tone, label, value, helper }: { icon: typeof Activity; tone: keyof typeof TONE; label: string; value: string; helper?: string }) {
  const t = TONE[tone];
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: t.bg, color: t.color }}>
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="truncate text-[18px] font-extrabold" style={{ color: "var(--text-main)" }}>{value}</p>
        {helper ? <p className="text-[11px]" style={{ color: "var(--text-hint)" }}>{helper}</p> : null}
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, description, cta, wide, children }: { icon: typeof Activity; title: string; description?: string; cta?: { href: string; label: string }; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white ${wide ? "lg:col-span-2" : ""}`} style={{ borderColor: "var(--border)" }}>
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

function InfoRow({ label, value, tone }: { label: string; value: string; tone: keyof typeof TONE }) {
  const t = TONE[tone];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: t.bg, color: t.color }}>{value}</span>
    </div>
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
