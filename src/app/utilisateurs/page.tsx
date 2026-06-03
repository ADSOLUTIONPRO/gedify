import { ResourceListView } from "@/components/paperless/resource-list-view";
import { safePaperlessCollection } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

export default async function UtilisateursPage() {
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
