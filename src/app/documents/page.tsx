import { DocumentsCollection } from "@/components/documents/documents-collection";
import type { PageSearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";

/** « Tous les documents » : documents actifs (non archivés). Onglets favoris /
    récents gérés via ?tab=. Voir DocumentsCollection (composant partagé). */
export default async function DocumentsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  return <DocumentsCollection params={params} basePath="/documents" scope="default" />;
}
