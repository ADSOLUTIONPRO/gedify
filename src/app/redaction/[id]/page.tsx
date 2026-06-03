import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Pencil,
  Send,
  User,
} from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { getWriterDocument } from "@/lib/writer/writer-store";
import { isOnlyOfficeConfigured } from "@/lib/writer/onlyoffice-config";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DocumentOverviewPage({ params }: Props) {
  const { id } = await params;
  const document = await getWriterDocument(id);

  if (!document) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          backLink={{ href: "/redaction", label: "Rédaction" }}
          eyebrow="Document"
          title="Document introuvable"
        />
        <ErrorState message="Aucun document avec cet identifiant." />
      </main>
    );
  }

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/redaction", label: "Rédaction" }}
        eyebrow={`Document #${document.id.slice(0, 8)}`}
        title={document.title}
        description={document.subject || "Aperçu du courrier."}
        actions={
          <>
            <Link
              href={`/redaction/${document.id}/modifier`}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Modifier dans ONLYOFFICE
            </Link>
            <a
              href={`/api/writer/documents/${document.id}/file`}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Télécharger .docx
            </a>
          </>
        }
      />

      {!isOnlyOfficeConfigured() ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 backdrop-blur">
          <ExternalLink
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-xs leading-6 text-amber-900">
            ONLYOFFICE Docs n&apos;est pas configuré. L&apos;édition en ligne et la conversion PDF ne
            fonctionneront pas tant que <code className="font-mono">ONLYOFFICE_DOCUMENT_SERVER_URL</code>{" "}
            n&apos;est pas défini.
          </p>
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Statut"
          value={document.status}
          icon={CheckCircle2}
          tone={document.status === "sent-to-paperless" ? "emerald" : "blue"}
        />
        <StatCard
          label="Version"
          value={`v${document.version}`}
          helper={`Taille ${(document.fileSize / 1024).toFixed(1)} ko`}
          icon={Layers}
          tone="violet"
        />
        <StatCard
          label="Créé le"
          value={new Date(document.createdAt).toLocaleDateString("fr-FR")}
          icon={Calendar}
        />
        <StatCard
          label="MAJ"
          value={new Date(document.updatedAt).toLocaleString("fr-FR")}
          icon={Calendar}
          tone="emerald"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard icon={FileText} title="Informations du courrier">
          <MetadataGrid
            items={[
              { label: "Titre", value: document.title },
              { label: "Type", value: document.letterType },
              { label: "Modèle", value: document.templateId ?? "Aucun" },
              {
                label: "Destinataire",
                icon: <User className="h-3 w-3" strokeWidth={2} />,
                value: document.recipient || "—",
              },
              { label: "Adresse", value: document.recipientAddress || "—" },
              { label: "Objet", value: document.subject || "—" },
              { label: "Référence", value: document.reference || "—" },
              {
                label: "Tâche Gedify",
                value: document.paperlessTaskId ?? "—",
              },
            ]}
          />
        </SectionCard>

        <SectionCard icon={Send} title="Classement Gedify prévu">
          <MetadataGrid
            items={[
              {
                label: "Correspondant",
                value: document.paperlessCorrespondent ?? "Non défini",
              },
              {
                label: "Type Gedify",
                value: document.paperlessDocumentType ?? "Non défini",
              },
              {
                label: "Tags",
                value:
                  document.paperlessTags.length > 0
                    ? document.paperlessTags.join(", ")
                    : "Aucun",
              },
              {
                label: "Dossier / projet",
                value: document.projectId ?? "Aucun",
              },
            ]}
          />
        </SectionCard>
      </div>
    </main>
  );
}
