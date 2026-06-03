import { redirect } from "next/navigation";
import { getDocument } from "@/lib/paperless";
import { getDocumentDisplayTitle } from "@/lib/documents/document-title-utils";
import { getTitleOverride } from "@/lib/documents/document-title-store";
import { DocumentSignEditor } from "@/components/documents/document-sign-editor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Page plein écran d'édition de signature PDF (gated PDF). */
export default async function DocumentSignerPage({ params }: Props) {
  const { id } = await params;
  const docId = Number.parseInt(id, 10);

  let title = `Document ${id}`;
  try {
    const doc = await getDocument(id);
    const mime = doc.mime_type ?? "";
    if (!mime.toLowerCase().includes("pdf")) redirect(`/documents/${id}`);
    const override = Number.isFinite(docId) ? await getTitleOverride(docId) : null;
    title = getDocumentDisplayTitle({ document: doc, override, aiSuggestedTitle: null, aiTitleConfidence: null }).displayTitle;
  } catch {
    redirect(`/documents/${id}`);
  }

  return <DocumentSignEditor documentId={docId} title={title} />;
}
