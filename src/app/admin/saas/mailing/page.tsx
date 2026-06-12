import { AlertTriangle, BellRing, LayoutTemplate, Mail, Megaphone, Send, ShieldCheck, Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { AdminNavGrid, AdminNavTile } from "@/components/admin-ui";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSmtpStatus } from "@/lib/saas/mailing/config";
import { getQueueStats } from "@/lib/saas/mailing/queue";
import { runRemindersAction, processQueueAction, sendTestAction, verifySmtpAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Mailing" },
];

const LINKS = [
  { href: "/admin/saas/mailing/templates", icon: LayoutTemplate, title: "Modèles", desc: "Emails transactionnels." },
  { href: "/admin/saas/mailing/queue", icon: Inbox, title: "File d'attente", desc: "Envois en cours / échoués." },
  { href: "/admin/saas/mailing/campaigns", icon: Megaphone, title: "Campagnes", desc: "Emailing groupé." },
];

function yn(b: boolean): string { return b ? "✓ configuré" : "✗ absent"; }

export default async function MailingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Mailing" /><SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Mailing" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const [smtp, stats] = await Promise.all([Promise.resolve(getSmtpStatus()), getQueueStats()]);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Mailing / Notifications" description="Emails transactionnels (SMTP o2switch), relances de paiement et campagnes." />

      {sp.test ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Email de test : {sp.test}.</div> : null}
      {sp.smtp === "ok" ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Connexion SMTP vérifiée.</div> : null}
      {sp.smtp === "fail" ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">Échec de la connexion SMTP (voir configuration env).</div> : null}
      {sp.reminders ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Relances : {sp.reminders} email(s) en file, {sp.suspended ?? 0} abonnement(s) basculé(s) en impayé.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      {!smtp.enabled ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Le mailing est désactivé (<code className="font-mono">EMAILS_ENABLED=false</code>). Les emails sont mis en file mais non envoyés.</span>
        </div>
      ) : null}

      <SectionCard icon={Mail} title="Configuration SMTP (sans secret)">
        <MetadataGrid columns={3} items={[
          { label: "Mailing activé", value: smtp.enabled ? "Oui" : "Non" },
          { label: "Serveur SMTP", value: yn(smtp.hostConfigured) + (smtp.host ? ` (${smtp.host}:${smtp.port ?? "?"})` : "") },
          { label: "Sécurité", value: smtp.secure == null ? "—" : smtp.secure ? "SSL/TLS (465)" : "STARTTLS (587)" },
          { label: "Utilisateur", value: yn(smtp.userConfigured) },
          { label: "Mot de passe", value: smtp.passwordConfigured ? "✓ présent (masqué)" : "✗ absent" },
          { label: "Expéditeur", value: smtp.fromEmail ?? "—" },
        ]} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <form action={verifySmtpAction}><button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>Vérifier la connexion</button></form>
          <form action={sendTestAction} className="flex items-center gap-2">
            <input name="to" type="email" required placeholder="email de test" className="h-9 rounded-lg border px-2 text-[13px]" style={{ borderColor: "var(--border)" }} />
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white" style={{ background: "var(--blue-600)" }}><Send className="h-4 w-4" />Envoyer un test</button>
          </form>
        </div>
      </SectionCard>

      <SectionCard icon={Inbox} title="File d'attente">
        <MetadataGrid columns={3} items={[
          { label: "En attente", value: String(stats.pending) },
          { label: "Envoyés", value: String(stats.sent) },
          { label: "Échoués", value: String(stats.failed) },
          { label: "En cours", value: String(stats.sending) },
          { label: "Ignorés", value: String(stats.skipped) },
          { label: "Total", value: String(stats.total) },
        ]} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <form action={processQueueAction}><button className="h-9 rounded-lg px-3 text-[12px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Traiter la file</button></form>
          <form action={runRemindersAction}><button className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}><BellRing className="h-4 w-4" />Lancer les relances</button></form>
        </div>
      </SectionCard>

      <AdminNavGrid columns={3}>
        {LINKS.map((l) => (
          <AdminNavTile key={l.href} href={l.href} icon={l.icon} title={l.title} desc={l.desc} />
        ))}
      </AdminNavGrid>
    </PageShell>
  );
}
