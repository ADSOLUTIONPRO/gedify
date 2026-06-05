import { Database, ExternalLink, Hash, Sparkles, Unlock } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import type { PaperlessResource } from "@/lib/paperless-resource-types";
import { formatPaperlessValue, getResourceTitle } from "@/lib/paperless-resources";
import { getPaperlessPublicUrl } from "@/lib/paperless";

type ResourceDetailViewProps = {
  eyebrow: string;
  titleFallback: string;
  description: string;
  result: { ok: true; data: PaperlessResource } | { ok: false; error: string };
  originalPath?: string;
  technicalNote?: string;
  backLink?: { href: string; label: string };
};

function isSensitiveKey(key: string) {
  return /password|token|secret|key/i.test(key);
}

export function ResourceDetailView({
  eyebrow,
  titleFallback,
  description,
  result,
  originalPath,
  technicalNote,
  backLink,
}: ResourceDetailViewProps) {
  const paperlessUrl = getPaperlessPublicUrl();
  const originalUrl = paperlessUrl && originalPath ? `${paperlessUrl}${originalPath}` : paperlessUrl;
  const title = result.ok ? getResourceTitle(result.data) : titleFallback;
  const entries = result.ok
    ? Object.entries(result.data).filter(([key]) => !isSensitiveKey(key))
    : [];

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={backLink}
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          originalUrl ? (
            <a
              href={originalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Ouvrir le document
            </a>
          ) : null
        }
      />

      {technicalNote ? (
        <div className="mb-6 rounded-2xl border border-blue-200/60 bg-blue-50/60 p-4 text-sm leading-6 text-blue-900 backdrop-blur">
          {technicalNote}
        </div>
      ) : null}

      {!result.ok ? (
        <ErrorState
          title="Fonction bientôt disponible"
          message={
            /\b(40\d|50\d|endpoint|moteur|\/api\/|implémenté|token|scope|undefined)\b/i.test(result.error ?? "")
              ? "Cette fonctionnalité n'est pas encore disponible dans cette version."
              : result.error
          }
        />
      ) : (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <StatCard
              label="ID"
              value={formatPaperlessValue(result.data.id)}
              helper="Identifiant Gedify"
              icon={Hash}
              tone="blue"
            />
            <StatCard
              label="Modifiable"
              value={result.data.user_can_change === false ? "Non" : "Oui"}
              helper="Selon les permissions Gedify"
              icon={Unlock}
              tone="emerald"
            />
            <StatCard
              label="Source"
              value="API"
              helper="Lecture directe Gedify"
              icon={Database}
              tone="violet"
            />
          </section>

          <SectionCard icon={Sparkles} title="Données Gedify">
            <MetadataGrid
              items={entries.map(([key, value]) => ({
                label: key,
                value: formatPaperlessValue(value),
              }))}
            />
          </SectionCard>
        </>
      )}
    </main>
  );
}
