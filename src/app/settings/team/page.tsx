import Link from "next/link";
import { ShieldAlert, UserPlus, Users, Send } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { SettingsSubPage } from "@/components/settings/settings-ui";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { isFeatureEnabled } from "@/lib/saas/entitlements";
import { listTenantMembersWithUser } from "@/lib/tenant/tenant-store";
import { canManageTenantMembers, assignableRoles } from "@/lib/tenant/permissions";
import { getInvitationsForTenant } from "@/lib/saas/invitations";
import { getTenantPlanLimits } from "@/lib/saas/quota";
import { inviteMemberAction, changeMemberRoleAction, removeMemberAction, resendInviteAction, cancelInviteAction } from "./actions";

export const dynamic = "force-dynamic";

const inp = "h-9 rounded-lg border px-2 text-[13px]";
const bd = { borderColor: "var(--border)" };
const ROLE: Record<string, string> = { owner: "Propriétaire", admin: "Admin", member: "Membre", viewer: "Lecteur" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) {
    return <SettingsSubPage title="Mon équipe"><SectionCard icon={Users} title="Aucun espace"><p className="text-sm text-slate-600">Sélectionnez un espace.</p></SectionCard></SettingsSubPage>;
  }
  const manage = canManageTenantMembers(ctx.role);
  const [members, invitations, limits, canInvite] = await Promise.all([
    listTenantMembersWithUser(ctx.tenantId),
    manage ? getInvitationsForTenant(ctx.tenantId) : Promise.resolve([]),
    getTenantPlanLimits(ctx.tenantId).catch(() => ({ maxUsers: null as number | null })),
    isFeatureEnabled(ctx.tenantId, "user_invitations_enabled").catch(() => false),
  ]);
  const pending = invitations.filter((i) => i.status === "pending");
  const roles = assignableRoles(ctx.role);

  return (
    <SettingsSubPage title="Mon équipe" subtitle={`Membres de ${ctx.tenant.name ?? ctx.tenantId}.`}>
      {sp.ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Opération effectuée.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      {manage && canInvite ? (
        <SectionCard icon={UserPlus} title="Inviter un membre">
          <form action={inviteMemberAction} className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Email</span><br /><input name="email" type="email" required className={inp} style={bd} placeholder="collegue@exemple.fr" /></label>
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Rôle</span><br /><select name="role" className={inp} style={bd} defaultValue={roles.includes("member") ? "member" : roles[0]}>{roles.map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select></label>
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Validité</span><br /><select name="duration" className={inp} style={bd} defaultValue="7d"><option value="24h">24 h</option><option value="7d">7 jours</option><option value="14d">14 jours</option><option value="30d">30 jours</option></select></label>
            <button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Envoyer l&apos;invitation</button>
          </form>
          <p className="mt-2 text-[12px] text-slate-500">{members.length}{limits.maxUsers != null ? ` / ${limits.maxUsers}` : ""} membre(s){pending.length ? ` · ${pending.length} invitation(s) en attente` : ""}.</p>
        </SectionCard>
      ) : manage && !canInvite ? (
        <SectionCard icon={ShieldAlert} title="Invitations non incluses"><p className="text-sm text-slate-600">Votre offre n&apos;inclut pas les invitations de membres. <Link href="/pricing" style={{ color: "var(--blue-600)" }}>Voir les offres →</Link></p></SectionCard>
      ) : null}

      <SectionCard icon={Users} title={`Membres (${members.length})`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
              <th className="px-4 py-2">Membre</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Rôle</th>{manage ? <th className="px-4 py-2"></th> : null}
            </tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                  <td className="px-4 py-2 font-medium">{m.username ?? `#${m.userId}`}{m.userId === ctx.userId ? <span className="ml-1 text-[10px] text-slate-400">(vous)</span> : null}</td>
                  <td className="px-4 py-2">{m.email ?? "—"}</td>
                  <td className="px-4 py-2">
                    {manage && m.userId !== ctx.userId && (ctx.role === "owner" || m.role !== "owner") ? (
                      <form action={changeMemberRoleAction} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={m.userId} />
                        <select name="role" defaultValue={m.role} className="h-7 rounded border px-1 text-[11px]" style={bd}>{roles.map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select>
                        <button className="h-7 rounded border px-2 text-[11px] font-semibold" style={bd}>OK</button>
                      </form>
                    ) : (ROLE[m.role] ?? m.role)}
                  </td>
                  {manage ? (
                    <td className="px-4 py-2 text-right">
                      {m.userId !== ctx.userId && (ctx.role === "owner" || m.role !== "owner") ? (
                        <form action={removeMemberAction}><input type="hidden" name="userId" value={m.userId} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Retirer</button></form>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {manage && pending.length > 0 ? (
        <SectionCard icon={Send} title={`Invitations en attente (${pending.length})`} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Email</th><th className="px-4 py-2">Rôle</th><th className="px-4 py-2">Expire</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {pending.map((i) => (
                  <tr key={i.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2">{i.email}</td>
                    <td className="px-4 py-2">{ROLE[i.role] ?? i.role}</td>
                    <td className="px-4 py-2 text-[11px]">{i.expiresAt ? new Date(i.expiresAt).toLocaleDateString("fr-FR") : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <form action={resendInviteAction}><input type="hidden" name="id" value={i.id} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={bd}>Renvoyer</button></form>
                        <form action={cancelInviteAction}><input type="hidden" name="id" value={i.id} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Annuler</button></form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </SettingsSubPage>
  );
}
