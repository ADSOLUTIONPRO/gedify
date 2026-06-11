import Link from "next/link";
import { Users } from "lucide-react";
import { ResourceListView } from "@/components/paperless/resource-list-view";
import { safePaperlessCollection } from "@/lib/paperless-resources";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { listTenantMembersWithUser } from "@/lib/tenant/tenant-store";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { owner: "Propriétaire", admin: "Administrateur", member: "Membre", viewer: "Lecteur" };

export default async function UtilisateursPage() {
  const me = await getCurrentUser();
  const multi = isMultiTenantEnabled();

  // ── Vue TENANT (client) : un membre ne voit QUE les membres de son espace ──
  if (multi && !me?.is_superuser) {
    const ctx = await getCurrentTenant().catch(() => null);
    const members = ctx ? await listTenantMembersWithUser(ctx.tenantId).catch(() => []) : [];
    return (
      <PageShell>
        <PageHeader
          breadcrumb={[{ href: "/dashboard", label: "Accueil" }, { href: "/administration", label: "Administration" }, { label: "Membres" }]}
          title="Membres de l'espace"
          description={ctx ? `Membres de ${ctx.tenant.name ?? ctx.tenantId}.` : "Aucun espace actif."}
        />
        <SectionCard icon={Users} title={`${members.length} membre(s)`} bodyClassName="p-0">
          {members.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Aucun membre.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                  <th className="px-4 py-2">Identifiant</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Rôle</th>
                </tr></thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.userId} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-4 py-2 font-medium">{m.username ?? `#${m.userId}`}</td>
                      <td className="px-4 py-2">{m.email ?? "—"}</td>
                      <td className="px-4 py-2">{ROLE_LABEL[m.role] ?? m.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
        <p className="text-[12px] text-slate-500">Pour inviter un membre, rendez-vous sur <Link href="/settings/team" style={{ color: "var(--blue-600)" }}>Mon équipe</Link> (selon votre offre).</p>
      </PageShell>
    );
  }

  // ── Vue GLOBALE (superuser plateforme ou mono-tenant local) ──
  const result = await safePaperlessCollection("/api/users/");
  return (
    <ResourceListView
      backLink={{ href: "/administration", label: "Administration" }}
      eyebrow="Administration Gedify"
      title="Utilisateurs"
      description="Comptes utilisateurs du moteur local."
      result={result}
      originalPath="/users"
      detailBasePath="/utilisateurs"
      fields={[
        { key: "username", label: "Identifiant" },
        { key: "email", label: "Email" },
        { key: "is_active", label: "Actif" },
      ]}
    />
  );
}
