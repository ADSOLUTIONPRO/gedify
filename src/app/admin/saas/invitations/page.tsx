import Link from "next/link";
import { AlertTriangle, Send, ShieldCheck, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { areEmailsEnabled } from "@/lib/config/environment";
import { listTenants } from "@/lib/tenant/tenant-store";
import { listAllInvitations } from "@/lib/saas/invitations";
import { createInvitationAction, resendInvitationAction, cancelInvitationAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Invitations" },
];
const inp = "h-9 rounded-lg border px-2 text-[13px]";
const bd = { borderColor: "var(--border)" };
const STATUS: Record<string, { l: string; bg: string; fg: string }> = {
  pending: { l: "En attente", bg: "#FEF3C7", fg: "#B45309" },
  accepted: { l: "Acceptée", bg: "#DCFCE7", fg: "#15803D" },
  expired: { l: "Expirée", bg: "#F1F5F9", fg: "#64748b" },
  canceled: { l: "Annulée", bg: "#FEE2E2", fg: "#B91C1C" },
};
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Invitations" /><SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Invitations" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const [invitations, tenants] = await Promise.all([listAllInvitations(), listTenants().catch(() => [])]);
  const tName = new Map(tenants.map((t) => [t.id, t.name ?? t.slug ?? t.id]));
  const count = (st: string) => invitations.filter((i) => i.status === st).length;
  const recent7d = invitations.filter((i) => i.createdAt && Date.now() - new Date(i.createdAt).getTime() < 7 * 86400000).length;
  const emailsOn = areEmailsEnabled();

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Invitations clients" description="Inviter des membres dans les espaces clients (superuser)." />
      {sp.ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Invitation {sp.ok === "created" ? "créée" : sp.ok === "resent" ? "renvoyée" : "annulée"}.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}
      {!emailsOn ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Les emails sont désactivés (<code className="font-mono">EMAILS_ENABLED=false</code>) : l&apos;invitation sera créée mais l&apos;email mis en file ne partira qu&apos;une fois le mailing activé.</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="En attente" value={String(count("pending"))} />
        <StatCard label="Acceptées" value={String(count("accepted"))} />
        <StatCard label="Expirées" value={String(count("expired"))} />
        <StatCard label="Annulées" value={String(count("canceled"))} />
        <StatCard label="Envoyées (7j)" value={String(recent7d)} />
      </div>

      <SectionCard icon={Plus} title="Nouvelle invitation">
        <form action={createInvitationAction} className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Client</span><br /><select name="tenantId" required className={inp} style={bd}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.slug}</option>)}</select></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Email</span><br /><input name="email" type="email" required className={inp} style={bd} placeholder="user@exemple.fr" /></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Rôle</span><br /><select name="role" className={inp} style={bd} defaultValue="member"><option value="owner">Propriétaire</option><option value="admin">Admin</option><option value="member">Membre</option><option value="viewer">Lecteur</option></select></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Validité</span><br /><select name="duration" className={inp} style={bd} defaultValue="7d"><option value="24h">24 h</option><option value="7d">7 jours</option><option value="14d">14 jours</option><option value="30d">30 jours</option></select></label>
          <button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Inviter</button>
        </form>
      </SectionCard>

      <SectionCard icon={Send} title={`${invitations.length} invitation(s)`} bodyClassName="p-0">
        {invitations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune invitation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2">Email</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Rôle</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Expire</th><th className="px-3 py-2">Envois</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {invitations.map((i) => {
                  const st = STATUS[i.status] ?? STATUS.pending;
                  return (
                    <tr key={i.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-3 py-2">{i.email}</td>
                      <td className="px-3 py-2">{tName.get(i.tenantId) ?? i.tenantId}</td>
                      <td className="px-3 py-2">{i.role}</td>
                      <td className="px-3 py-2"><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.l}</span></td>
                      <td className="px-3 py-2 text-[11px]">{date(i.expiresAt)}</td>
                      <td className="px-3 py-2">{i.sendCount}</td>
                      <td className="px-3 py-2 text-right">
                        {i.status === "pending" ? (
                          <div className="flex justify-end gap-1.5">
                            <form action={resendInvitationAction}><input type="hidden" name="id" value={i.id} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={bd}>Renvoyer</button></form>
                            <form action={cancelInvitationAction}><input type="hidden" name="id" value={i.id} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Annuler</button></form>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="text-[12px] text-slate-500"><Link href="/admin/saas/memberships" style={{ color: "var(--blue-600)" }}>← Membres clients</Link></p>
    </PageShell>
  );
}
