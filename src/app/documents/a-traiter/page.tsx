import type { Metadata } from "next";
import { DocumentsCollection } from "@/components/documents/documents-collection";
import type { PageSearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "À traiter — Documents" };

/** Documents nécessitant une action (OCR/IA/classement incomplets). */
export default async function DocumentsAtraiterPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  return <DocumentsCollection params={params} basePath="/documents/a-traiter" scope="a-traiter" />;
}
