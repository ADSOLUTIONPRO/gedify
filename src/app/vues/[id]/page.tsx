import { ResourceDetailView } from "@/components/paperless/resource-detail-view";
import { safePaperlessObject } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VueDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await safePaperlessObject(`/api/saved_views/${id}/`);

  return (
    <ResourceDetailView
      eyebrow="Vue sauvegardée"
      titleFallback={`Vue #${id}`}
      description="Détail de la vue sauvegardée Gedify."
      result={result}
      originalPath={`/saved_views/${id}`}
    />
  );
}
