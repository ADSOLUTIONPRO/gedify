import { CopyCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { DuplicatesPanel } from "@/components/admin/duplicates-panel";

export const dynamic = "force-dynamic";

export default function DoublonsPage() {
  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/administration", label: "Administration" },
          { label: "Doublons" },
        ]}
        title="Doublons"
        description="Détecte les documents en double (exacts et probables) et fusionne-les sans rien perdre."
      />

      <SectionCard
        icon={CopyCheck}
        title="Groupes de doublons"
        description="La fusion conserve le document choisi et envoie les autres à la corbeille (récupérables)."
      >
        <DuplicatesPanel />
      </SectionCard>
    </PageShell>
  );
}
