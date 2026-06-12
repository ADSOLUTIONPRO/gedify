import Link from "next/link";
import { AlertTriangle, ShieldCheck, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listTenants, listTenantMembersWithUser } from "@/lib/tenant/tenant-store";
import { listAllInvitations } from "@/lib/saas/invitations";
import { addMemberAction, changeRoleAction, removeMemberAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Membres" },
];
const inp = "h-9 rounded-lg border px-2 text-[13px]";
const bd = { borderColor: "var(--border)" };
const ROLES: { v: string; l: string }[] = [{ v: "owner", l: "Propriétaire" }, { v: "admin", l: "Admin" }, { v: "member", l: "Membre" }, { v: "viewer", l: "Lecteur" }];

export default async function MembershipsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Membres" /><SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Membres" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const tenants = await listTenants().catch(() => []);
  const perTenant = await Promise.all(tenants.map(async (t) => ({ tenant: t, members: await listTenantMembersWithUser(t.id).catch(() => []) })));
  const invitations = await listAllInvitations("pending").catch(() => []);

  const allUserIds = new Set<number>();
  const userTenantCount = new Map<number, number>();
  let activeMembers = 0;
  for (const { members } of perTenant) {
    for (const m of members) { allUserIds.add(m.userId); userTenantCount.set(m.userId, (userTenantCount.get(m.userId) ?? 0) + 1); activeMembers++; }
  }
  const tenantsNoOwner = perTenant.filter(({ members }) => !members.some((m) => m.role === "owner")).length;
  const multiTenantUsers = [...userTenantCount.values()].filter((n) => n > 1).length;

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Membres clients" description="Vue globale des membres par espace (superuser)." />
      {sp.ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Mise à jour effectuée.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Utilisateurs" value={String(allUserIds.size)} />
        <StatCard label="Membres actifs" value={String(activeMembers)} />
        <StatCard label="Invitations en attente" value={String(invitations.length)} />
        <StatCard label="Tenants sans owner" value={String(tenantsNoOwner)} />
        <StatCard label="Multi-tenants" value={String(multiTenantUsers)} />
      </div>

      <SectionCard icon={UserPlus} title="Ajouter un membre (compte existant)">
        <form action={addMemberAction} className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Client</span><br /><select name="tenantId" required className={inp} style={bd}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.slug}</option>)}</select></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Email / identifiant</span><br /><input name="email" required className={inp} style={bd} placeholder="user@exemple.fr" /></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Rôle</span><br /><select name="role" className={inp} style={bd} defaultValue="member">{ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select></label>
          <button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Ajouter</button>
          <Link href="/admin/saas/invitations" className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>ou inviter par email →</Link>
        </form>
      </SectionCard>

      {perTenant.map(({ tenant, members }) => (
        <SectionCard key={tenant.id} icon={Users} title={`${tenant.name ?? tenant.slug} (${members.length})`} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2">Membre</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Rôle</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-3 py-2 font-medium">{m.username ?? `#${m.userId}`}{userTenantCount.get(m.userId)! > 1 ? <span className="ml-1 text-[10px] text-slate-400">(multi)</span> : null}</td>
                    <td className="px-3 py-2">{m.email ?? "—"}</td>
                    <td className="px-3 py-2">
                      <form action={changeRoleAction} className="flex items-center gap-1">
                        <input type="hidden" name="tenantId" value={tenant.id} /><input type="hidden" name="userId" value={m.userId} />
                        <select name="role" defaultValue={m.role} className="h-7 rounded border px-1 text-[11px]" style={bd}>{ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
                        <button className="h-7 rounded border px-2 text-[11px] font-semibold" style={bd}>OK</button>
                      </form>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <form action={removeMemberAction}><input type="hidden" name="tenantId" value={tenant.id} /><input type="hidden" name="userId" value={m.userId} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Retirer</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ))}
    </PageShell>
  );
}
