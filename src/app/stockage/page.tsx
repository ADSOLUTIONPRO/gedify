import { HardDrive } from "lucide-react";
import { ResourceListView } from "@/components/paperless/resource-list-view";
import { HelpCard } from "@/components/ui/help-card";
import { safePaperlessCollection } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

export default async function StockagePage() {
  const result = await safePaperlessCollection("/api/storage_paths/");

  return (
    <ResourceListView
      eyebrow="Classement"
      title="Chemins de stockage"
      description="Les chemins de stockage définissent où Gedify range physiquement vos fichiers archivés."
      result={result}
      originalPath="/storage_paths"
      detailBasePath="/stockage"
      help={
        <HelpCard
          tone="amber"
          icon={HardDrive}
          title="Un chemin de stockage répond à la question : où ce document est-il rangé ?"
          description="Gedify organise vos fichiers dans des sous-dossiers selon des règles personnalisables (par type, correspondant, année…)."
          examples={[
            "{correspondent}/{document_type}",
            "{created_year}/{correspondent}",
            "Factures/{correspondent}",
          ]}
        />
      }
      fields={[
        { key: "path", label: "Chemin" },
        { key: "match", label: "Correspondance" },
        { key: "document_count", label: "Documents" },
      ]}
    />
  );
}
