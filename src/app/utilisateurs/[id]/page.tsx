import { ResourceDetailView } from "@/components/paperless/resource-detail-view";
import { safePaperlessObject } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function UtilisateurDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await safePaperlessObject(`/api/users/${id}/`);

  return (
    <ResourceDetailView
      backLink={{ href: "/utilisateurs", label: "Utilisateurs" }}
      eyebrow="Utilisateur"
      titleFallback={`Utilisateur #${id}`}
      description="Détail du compte utilisateur Gedify. Les champs sensibles sont masqués."
      result={result}
      originalPath={`/users/${id}`}
    />
  );
}
