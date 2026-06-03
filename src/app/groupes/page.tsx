import { ResourceListView } from "@/components/paperless/resource-list-view";
import { safePaperlessCollection } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

export default async function GroupesPage() {
  const result = await safePaperlessCollection("/api/groups/");

  return (
    <ResourceListView
      backLink={{ href: "/administration", label: "Administration" }}
      eyebrow="Administration Gedify"
      title="Groupes"
      description="Groupes et permissions Gedify."
      result={result}
      originalPath="/groups"
      detailBasePath="/groupes"
      fields={[
        { key: "name", label: "Nom" },
        { key: "permissions", label: "Permissions" },
        { key: "users", label: "Utilisateurs" },
      ]}
    />
  );
}
