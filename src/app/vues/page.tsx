import { Bookmark } from "lucide-react";
import { ResourceListView } from "@/components/paperless/resource-list-view";
import { HelpCard } from "@/components/ui/help-card";
import { safePaperlessCollection } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

export default async function VuesPage() {
  const result = await safePaperlessCollection("/api/saved_views/");

  return (
    <ResourceListView
      eyebrow="Classement"
      title="Vues sauvegardées"
      description="Une vue sauvegardée enregistre une recherche et ses filtres pour la retrouver en un clic."
      result={result}
      originalPath="/saved_views"
      detailBasePath="/vues"
      help={
        <HelpCard
          tone="violet"
          icon={Bookmark}
          title="Une vue sauvegardée répond à la question : comment je veux voir mes documents ?"
          description="Combinez un correspondant, un type et des tags, sauvegardez la recherche, et retrouvez l'ensemble plus tard sans tout refiltrer."
          examples={[
            "Factures EDF de cette année",
            "Documents à traiter",
            "Bulletins de salaire 2026",
            "Courriers de la mutuelle",
          ]}
        />
      }
      fields={[
        { key: "show_on_dashboard", label: "Dashboard" },
        { key: "show_in_sidebar", label: "Sidebar" },
        { key: "sort_field", label: "Tri" },
      ]}
    />
  );
}
