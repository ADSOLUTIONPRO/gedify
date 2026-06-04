import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { RolesPanel } from "@/components/admin/roles-panel";

export const dynamic = "force-dynamic";

export default function RolesPage() {
  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/administration", label: "Administration" },
          { label: "Rôles & permissions" },
        ]}
        title="Rôles & permissions"
        description="Attribuez un rôle à chaque utilisateur et consultez le journal d'audit des actions sensibles."
      />

      <SectionCard
        icon={ShieldCheck}
        title="Rôles utilisateurs & audit"
        description="Les rôles déterminent les permissions (documents, finances, mails, automatisations, sauvegardes, administration)."
      >
        <RolesPanel />
      </SectionCard>
    </PageShell>
  );
}
