import { DocumentToolbar } from "@/components/writer/document-toolbar";
import { OnlyOfficeEditor } from "@/components/writer/onlyoffice-editor";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  getOnlyOfficeServerUrl,
  isOnlyOfficeConfigured,
} from "@/lib/writer/onlyoffice-config";
import { getWriterDocument } from "@/lib/writer/writer-store";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditDocumentPage({ params }: Props) {
  const { id } = await params;
  const document = await getWriterDocument(id);

  if (!document) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          backLink={{ href: "/redaction", label: "Rédaction" }}
          eyebrow="Édition"
          title="Document introuvable"
        />
        <ErrorState message="Aucun document avec cet identifiant." />
      </main>
    );
  }

  if (!isOnlyOfficeConfigured()) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          backLink={{ href: `/redaction/${id}`, label: "Document" }}
          eyebrow="Édition"
          title={document.title}
          description="ONLYOFFICE Docs n'est pas configuré sur ce serveur."
        />
        <ErrorState
          title="ONLYOFFICE à connecter"
          message="Définissez ONLYOFFICE_DOCUMENT_SERVER_URL côté serveur (et idéalement ONLYOFFICE_JWT_SECRET) pour activer l'édition en ligne. Voir docs/ONLYOFFICE_SETUP.md."
        />
      </main>
    );
  }

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: `/redaction/${id}`, label: "Document" }}
        eyebrow="Édition en ligne"
        title={document.title}
        description={`Éditeur ONLYOFFICE (${getOnlyOfficeServerUrl()}). Sauvegarde automatique via callback.`}
      />

      <DocumentToolbar document={document} />

      <OnlyOfficeEditor documentId={document.id} />

      <p className="mt-4 text-xs text-slate-500">
        Insertion automatique de signature à connecter — pour l&apos;instant, utilisez le menu{" "}
        <em>Insérer → Image</em> de ONLYOFFICE, ou téléchargez votre signature depuis l&apos;onglet{" "}
        <em>Signatures</em>.
      </p>
    </main>
  );
}
