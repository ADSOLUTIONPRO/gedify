import { ListChecks } from "lucide-react";
import { ResourceListView } from "@/components/paperless/resource-list-view";
import { HelpCard } from "@/components/ui/help-card";
import { safePaperlessCollection } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

export default async function ChampsPersonnalisesPage() {
  const result = await safePaperlessCollection("/api/custom_fields/");

  return (
    <ResourceListView
      eyebrow="Classement"
      title="Champs personnalisés"
      description="Ajoutez vos propres champs (montant, échéance, référence…) en plus des métadonnées standards du moteur local."
      result={result}
      originalPath="/custom_fields"
      detailBasePath="/champs-personnalises"
      help={
        <HelpCard
          tone="blue"
          icon={ListChecks}
          title="Un champ personnalisé répond à un besoin que Gedify ne couvre pas par défaut."
          description="Créez un champ pour stocker une information spécifique (un montant, une date d'échéance, un numéro client…) qui pourra ensuite être renseignée sur chaque document."
          examples={["Montant TTC", "Échéance", "N° client", "Référence dossier", "Période"]}
        />
      }
      fields={[
        { key: "data_type", label: "Type" },
        { key: "extra_data", label: "Configuration" },
        { key: "document_count", label: "Documents" },
      ]}
    />
  );
}
