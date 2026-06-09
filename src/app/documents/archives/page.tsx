import type { Metadata } from "next";
import { DocumentsCollection } from "@/components/documents/documents-collection";
import type { PageSearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Archives — Documents" };

/** Documents au statut archivé (store GEDify). Action : Désarchiver. */
export default async function DocumentsArchivesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  return <DocumentsCollection params={params} basePath="/documents/archives" scope="archives" />;
}
