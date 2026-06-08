import { HeartPulse, Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { HealthDashboard } from "@/components/admin/health-dashboard";
import { TaxonomyHealthPanel } from "@/components/admin/taxonomy-health-panel";

export const dynamic = "force-dynamic";

export default function SanteGedPage() {
  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/administration", label: "Administration" },
          { label: "Santé GED" },
        ]}
        title="Santé GED"
        description="État du stockage, des documents, de la base et des services — avec les outils de maintenance."
      />

      <SectionCard
        icon={HeartPulse}
        title="Diagnostic en direct"
        description="Indicateurs documentaires, fichiers dérivés, base PostgreSQL et sauvegardes."
      >
        <HealthDashboard />
      </SectionCard>

      <SectionCard
        icon={Tags}
        title="Taxonomies (tags, types, correspondants)"
        description="Intégrité des valeurs d'autocomplétion : entités réelles vs valeurs validées orphelines, avec réparation."
      >
        <TaxonomyHealthPanel />
      </SectionCard>
    </PageShell>
  );
}
