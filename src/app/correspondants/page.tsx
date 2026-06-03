import { FileText, Plug, Users } from "lucide-react";
import { TaxonomyManager } from "@/components/forms/taxonomy-manager";
import { ErrorState } from "@/components/ui/error-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getCorrespondents, getPaperlessPublicUrl } from "@/lib/paperless";

export const dynamic = "force-dynamic";

const CORRESPONDENT_SUGGESTIONS = [
  "CAF",
  "CPAM",
  "Impôts",
  "EDF",
  "Engie",
  "Banque",
  "Mutuelle",
  "Notaire",
  "Bailleur",
  "Employeur",
];

export default async function CorrespondantsPage() {
  try {
    const data = await getCorrespondents();
    const correspondents = data.results ?? [];
    const paperlessUrl = getPaperlessPublicUrl();
    const totalLinked = correspondents.reduce(
      (total, item) => total + (item.document_count ?? 0),
      0,
    );

    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Classement"
          title="Correspondants"
          description="Les correspondants représentent les organismes ou personnes liés à vos documents : CAF, CPAM, banque, notaire…"
        />

        <div className="mb-6">
          <HelpCard
            tone="violet"
            icon={Users}
            title="Un correspondant répond à la question : qui a émis ce document ?"
            description={
              <>
                Associez un <strong>correspondant</strong> à chaque document pour retrouver
                rapidement tout ce qui vient d&apos;un même organisme ou d&apos;une même personne.
              </>
            }
            examples={["CAF", "CPAM", "Impôts", "EDF", "Banque", "Mutuelle", "Notaire"]}
          />
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Correspondants"
            value={data.count}
            helper="Organismes et personnes configurés"
            icon={Users}
            tone="violet"
          />
          <StatCard
            label="Documents liés"
            value={totalLinked}
            helper="Total déclaré par Gedify"
            icon={FileText}
            tone="blue"
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
          items={correspondents}
          apiBase="/api/paperless/correspondents"
          detailBase="/correspondants"
          paperlessOriginalBase={paperlessUrl ? `${paperlessUrl}/correspondents` : undefined}
          documentParam="correspondent"
          noun="correspondant"
          nounPlural="correspondants"
          inputPlaceholder="Ex. CAF, CPAM, EDF…"
          suggestions={CORRESPONDENT_SUGGESTIONS}
          emptyTitle="Aucun correspondant pour le moment"
          emptyDescription="Commencez avec les organismes les plus courants : CAF, CPAM, Impôts, EDF, banque."
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader eyebrow="Classement" title="Correspondants" />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </main>
    );
  }
}
