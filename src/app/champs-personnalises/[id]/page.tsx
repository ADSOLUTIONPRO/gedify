import { ResourceDetailView } from "@/components/paperless/resource-detail-view";
import { safePaperlessObject } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ChampPersonnaliseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await safePaperlessObject(`/api/custom_fields/${id}/`);

  return (
    <ResourceDetailView
      eyebrow="Champ personnalisé"
      titleFallback={`Champ #${id}`}
      description="Détail du champ personnalisé Gedify."
      result={result}
      originalPath={`/custom_fields/${id}`}
    />
  );
}
