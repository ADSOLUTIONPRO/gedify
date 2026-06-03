import { FileText, Plug, Tag as TagIcon } from "lucide-react";
import { TaxonomyManager } from "@/components/forms/taxonomy-manager";
import { BadgeTag } from "@/components/ui/badge-tag";
import { ErrorState } from "@/components/ui/error-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { getPaperlessPublicUrl, getTags } from "@/lib/paperless";

export const dynamic = "force-dynamic";

const TAG_SUGGESTIONS = [
  "Maison",
  "Banque",
  "Santé",
  "Impôts",
  "Travail",
  "Famille",
  "Voiture",
  "Voyage",
  "Études",
  "À traiter",
];

export default async function TagsPage() {
  try {
    const data = await getTags();
    const tags = data.results ?? [];
    const paperlessUrl = getPaperlessPublicUrl();
    const topTags = [...tags]
      .sort((a, b) => (b.document_count ?? 0) - (a.document_count ?? 0))
      .slice(0, 12);
    const totalLinked = tags.reduce((total, item) => total + (item.document_count ?? 0), 0);

    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Organisation"
          title="Tags"
          description="Les tags servent à regrouper vos documents par thème : maison, banque, santé, impôts, travail…"
        />

        <div className="mb-6">
          <HelpCard
            tone="emerald"
            icon={TagIcon}
            title="Un tag répond à la question : à quel sujet ce document est-il lié ?"
            description={
              <>
                Un même document peut porter <strong>plusieurs tags</strong> pour le retrouver
                depuis plusieurs angles : par dossier, par projet, par urgence…
              </>
            }
            examples={["Maison", "Banque", "Santé", "Impôts", "Voiture", "À traiter"]}
          />
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Tags"
            value={data.count}
            helper="Étiquettes thématiques disponibles"
            icon={TagIcon}
            tone="emerald"
          />
          <StatCard
            label="Documents tagués"
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
            tone="violet"
          />
        </section>

        {topTags.length > 0 ? (
          <div className="mb-6">
            <SectionCard
              icon={TagIcon}
              title="Tags les plus utilisés"
              description="Triés par nombre de documents associés."
            >
              <div className="flex flex-wrap gap-1.5">
                {topTags.map((tag) => (
                  <BadgeTag key={tag.id} tag={tag} compact />
                ))}
              </div>
            </SectionCard>
          </div>
        ) : null}

        <TaxonomyManager
          items={tags}
          apiBase="/api/paperless/tags"
          detailBase="/tags"
          paperlessOriginalBase={paperlessUrl ? `${paperlessUrl}/tags` : undefined}
          documentParam="tag"
          noun="tag"
          nounPlural="tags"
          inputPlaceholder="Ex. Maison, Banque, Santé…"
          suggestions={TAG_SUGGESTIONS}
          emptyTitle="Aucun tag pour le moment"
          emptyDescription="Commencez avec les thèmes les plus fréquents : Maison, Banque, Santé, Impôts, Travail."
          colorEnabled
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader eyebrow="Organisation" title="Tags" />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </main>
    );
  }
}
