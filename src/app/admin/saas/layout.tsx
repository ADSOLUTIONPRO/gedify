import type { ReactNode } from "react";
import { headers } from "next/headers";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logSecurityEvent } from "@/lib/saas/security/security-events";

/* Garde commune des pages SaaS GLOBALES : superuser uniquement. Exception :
   /admin/saas/tenant = « espace courant » de l'owner (gère son propre accès). */

export default async function SaasAdminLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname === "/admin/saas/tenant") return <div className="au-scope">{children}</div>;

  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    await logSecurityEvent({
      eventType: "unauthorized_access", category: "access", severity: "warning",
      actorUserId: me?.id ?? null, targetType: "route", targetId: pathname,
      message: `Accès refusé à une page SaaS globale : ${pathname}`,
    });
    return (
      <PageShell>
        <PageHeader
          breadcrumb={[{ href: "/dashboard", label: "Accueil" }, { label: "Gestion clients" }]}
          title="Accès refusé"
          description="Cette section est réservée aux superusers plateforme."
        />
        <SectionCard icon={ShieldCheck} title="403 — Accès refusé">
          <p className="text-sm text-slate-600">
            La gestion SaaS (clients, plans, abonnements, facturation…) est réservée aux superusers.
          </p>
        </SectionCard>
      </PageShell>
    );
  }
  // `au-scope` : applique le design system Admin (champs/tables lisibles) à
  // toutes les pages /admin/saas/* sans les réécrire une par une.
  return <div className="au-scope">{children}</div>;
}
