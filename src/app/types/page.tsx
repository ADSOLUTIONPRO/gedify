import { Database, FileText, FileType2, Plug } from "lucide-react";
import { TaxonomyManager } from "@/components/forms/taxonomy-manager";
import { ErrorState } from "@/components/ui/error-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getDocumentTypes, getPaperlessPublicUrl } from "@/lib/paperless";

export const dynamic = "force-dynamic";

const TYPE_SUGGESTIONS = [
  "Facture",
  "Contrat",
  "Courrier administratif",
  "Avis d'imposition",
  "Bulletin de salaire",
  "Attestation",
  "Devis",
  "Relevé bancaire",
];

export default async function TypesPage() {
  try {
    const data = await getDocumentTypes();
    const types = data.results ?? [];
    const paperlessUrl = getPaperlessPublicUrl();
    const totalLinked = types.reduce((total, item) => total + (item.document_count ?? 0), 0);

    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Typologie"
          title="Types de documents"
          description="Classez vos documents selon leur nature : factures, contrats, courriers, attestations, avis fiscaux…"
        />

        <div className="mb-6">
          <HelpCard
            tone="blue"
            icon={FileType2}
            title="Un type répond à la question : qu'est-ce que ce document ?"
            description={
              <>
                Le type décrit la <strong>nature</strong> d&apos;un document. Combinez-le avec un{" "}
                <em>correspondant</em> (qui l&apos;a émis) et des <em>tags</em> (sujets) pour un classement
                complet.
              </>
            }
            examples={[
              "Facture EDF",
              "Contrat d'assurance",
              "Avis d'imposition",
              "Bulletin de salaire",
              "Courrier CAF",
            ]}
          />
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Types configurés"
            value={data.count}
            helper="Disponibles pour le classement"
            icon={FileType2}
            tone="blue"
          />
          <StatCard
            label="Documents liés"
            value={totalLinked}
            helper="Total déclaré par Gedify"
            icon={FileText}
            tone="violet"
          />
          <StatCard
            label="Source"
            value="API"
            helper="Synchronisé en direct avec Gedify"
            icon={Plug}
            tone="emerald"
          />
        </section>

        <TaxonomyManager
          items={types}
          apiBase="/api/paperless/document-types"
          detailBase="/types"
          paperlessOriginalBase={paperlessUrl ? `${paperlessUrl}/document-types` : undefined}
          documentParam="document_type"
          noun="type"
          nounPlural="types"
          inputPlaceholder="Ex. Facture, Contrat, Courrier…"
          suggestions={TYPE_SUGGESTIONS}
          emptyTitle="Aucun type pour le moment"
          emptyDescription="Commencez avec les types les plus fréquents : Facture, Contrat, Courrier administratif, Avis fiscal."
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader eyebrow="Typologie" title="Types de documents" />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-500">
          <Database className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Source : API du moteur
        </div>
      </main>
    );
  }
}
