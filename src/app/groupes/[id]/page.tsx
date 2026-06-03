import { ResourceDetailView } from "@/components/paperless/resource-detail-view";
import { safePaperlessObject } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GroupeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await safePaperlessObject(`/api/groups/${id}/`);

  return (
    <ResourceDetailView
      backLink={{ href: "/groupes", label: "Groupes" }}
      eyebrow="Groupe"
      titleFallback={`Groupe #${id}`}
      description="Détail du groupe Gedify."
      result={result}
      originalPath={`/groups/${id}`}
    />
  );
}
