import { ResourceDetailView } from "@/components/paperless/resource-detail-view";
import { safePaperlessObject } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function StockageDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await safePaperlessObject(`/api/storage_paths/${id}/`);

  return (
    <ResourceDetailView
      eyebrow="Chemin de stockage"
      titleFallback={`Chemin #${id}`}
      description="Détail du chemin de stockage Gedify."
      result={result}
      originalPath={`/storage_paths/${id}`}
    />
  );
}
