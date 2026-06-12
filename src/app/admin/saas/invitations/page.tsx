import Link from "next/link";
import { AlertTriangle, Send, ShieldCheck, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { areEmailsEnabled } from "@/lib/config/environment";
import { listTenants } from "@/lib/tenant/tenant-store";
import { listAllInvitations, type TenantInvitation } from "@/lib/saas/invitations";
import { AdminStats, AdminStatCard, AdminCard, AdminAlert, AdminBadge, AdminButton, AdminInput, AdminSelect, AdminFormSection, AdminDataTable, type AdminColumn, SuperAdminHero } from "@/components/admin-ui";
import { createInvitationAction, resendInvitationAction, cancelInvitationAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Invitations" },
];
type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";
const STATUS: Record<string, { l: string; tone: Tone }> = {
  pending: { l: "En attente", tone: "warning" }, accepted: { l: "Acceptée", tone: "success" },
  expired: { l: "Expirée", tone: "neutral" }, canceled: { l: "Annulée", tone: "danger" },
};
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Invitations" /><AdminCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></AdminCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Invitations" /><AdminCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></AdminCard></PageShell>;
  }

  const [invitations, tenants] = await Promise.all([listAllInvitations(), listTenants().catch(() => [])]);
  const tName = new Map(tenants.map((t) => [t.id, t.name ?? t.slug ?? t.id]));
  const count = (st: string) => invitations.filter((i) => i.status === st).length;
  const recent7d = invitations.filter((i) => i.createdAt && Date.now() - new Date(i.createdAt).getTime() < 7 * 86400000).length;
  const emailsOn = areEmailsEnabled();

  const columns: AdminColumn<TenantInvitation>[] = [
    { key: "email", header: "Email", cell: (i) => i.email },
    { key: "tenant", header: "Client", cell: (i) => tName.get(i.tenantId) ?? i.tenantId },
    { key: "role", header: "Rôle", cell: (i) => i.role },
    { key: "status", header: "Statut", cell: (i) => <AdminBadge tone={(STATUS[i.status] ?? STATUS.pending).tone}>{(STATUS[i.status] ?? STATUS.pending).l}</AdminBadge> },
    { key: "exp", header: "Expire", nowrap: true, cell: (i) => <span className="text-[11px]">{date(i.expiresAt)}</span> },
    { key: "sends", header: "Envois", align: "right", cell: (i) => i.sendCount },
    { key: "act", header: "", align: "right", cell: (i) => i.status === "pending" ? (
      <div className="flex justify-end gap-1.5">
        <form action={resendInvitationAction}><input type="hidden" name="id" value={i.id} /><AdminButton variant="secondary" sm type="submit">Renvoyer</AdminButton></form>
        <form action={cancelInvitationAction}><input type="hidden" name="id" value={i.id} /><AdminButton variant="danger" sm type="submit">Annuler</AdminButton></form>
      </div>
    ) : null },
  ];

  return (
    <PageShell>
      <SuperAdminHero breadcrumb={breadcrumb} eyebrow="Administration SaaS" title="Invitations clients" subtitle="Inviter des membres dans les espaces clients (superuser)." icon={<Send className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />} />
      {sp.ok ? <AdminAlert tone="success">Invitation {sp.ok === "created" ? "créée" : sp.ok === "resent" ? "renvoyée" : "annulée"}.</AdminAlert> : null}
      {sp.error ? <AdminAlert tone="danger">{sp.error}</AdminAlert> : null}
      {!emailsOn ? <AdminAlert tone="warning">Les emails sont désactivés (<code className="font-mono">EMAILS_ENABLED=false</code>) : l&apos;invitation sera créée mais l&apos;email ne partira qu&apos;une fois le mailing activé.</AdminAlert> : null}

      <AdminStats>
        <AdminStatCard label="En attente" value={count("pending")} tone="warning" />
        <AdminStatCard label="Acceptées" value={count("accepted")} tone="success" />
        <AdminStatCard label="Expirées" value={count("expired")} />
        <AdminStatCard label="Annulées" value={count("canceled")} />
        <AdminStatCard label="Envoyées (7j)" value={recent7d} tone="accent" />
      </AdminStats>

      <AdminCard icon={Plus} title="Nouvelle invitation">
        <form action={createInvitationAction}>
          <AdminFormSection columns={3}>
            <AdminSelect id="tenantId" name="tenantId" label="Client" required>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.slug}</option>)}</AdminSelect>
            <AdminInput id="email" name="email" type="email" label="Email" required placeholder="user@exemple.fr" />
            <AdminSelect id="role" name="role" label="Rôle" defaultValue="member"><option value="owner">Propriétaire</option><option value="admin">Admin</option><option value="member">Membre</option><option value="viewer">Lecteur</option></AdminSelect>
            <AdminSelect id="duration" name="duration" label="Validité" defaultValue="7d"><option value="24h">24 h</option><option value="7d">7 jours</option><option value="14d">14 jours</option><option value="30d">30 jours</option></AdminSelect>
          </AdminFormSection>
          <div className="mt-3"><AdminButton type="submit" variant="primary">Inviter</AdminButton></div>
        </form>
      </AdminCard>

      <AdminDataTable<TenantInvitation>
        title={`${invitations.length} invitation(s)`}
        columns={columns}
        rows={invitations}
        rowKey={(i) => i.id}
        emptyTitle="Aucune invitation"
      />

      <p className="text-[12px] text-slate-500"><Link href="/admin/saas/memberships" style={{ color: "var(--au-blue)" }}>← Membres clients</Link></p>
    </PageShell>
  );
}
