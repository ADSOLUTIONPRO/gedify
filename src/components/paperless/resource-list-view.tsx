import Link from "next/link";
import { Database, ExternalLink, Plug, Sparkles } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import type {
  NormalizedPaperlessCollection,
  PaperlessResource,
  ResourceField,
} from "@/lib/paperless-resource-types";
import {
  formatPaperlessValue,
  getResourceTitle,
  pickResourceSummary,
} from "@/lib/paperless-resources";
import { getPaperlessPublicUrl } from "@/lib/paperless";

type ResourceListViewProps = {
  title: string;
  eyebrow: string;
  description: string;
  result:
    | { ok: true; data: NormalizedPaperlessCollection }
    | { ok: false; error: string };
  originalPath?: string;
  detailBasePath?: string;
  fields?: ResourceField[];
  emptyTitle?: string;
  emptyDescription?: string;
  technicalNote?: string;
  backLink?: { href: string; label: string };
  help?: import("react").ReactNode;
};

export function ResourceListView({
  title,
  eyebrow,
  description,
  result,
  originalPath,
  detailBasePath,
  fields = [
    { key: "name", label: "Nom" },
    { key: "document_count", label: "Documents" },
    { key: "user_can_change", label: "Modifiable" },
  ],
  emptyTitle,
  emptyDescription,
  technicalNote,
  backLink,
  help,
}: ResourceListViewProps) {
  const paperlessUrl = getPaperlessPublicUrl();
  const originalUrl = paperlessUrl && originalPath ? `${paperlessUrl}${originalPath}` : paperlessUrl;
  const rows = result.ok ? result.data.results : [];
  const count = result.ok ? result.data.count : 0;

  const columns: DataTableColumn<PaperlessResource>[] = [
    {
      header: "Entrée",
      cell: (row) => {
        const titleText = getResourceTitle(row);

        return (
          <div>
            {detailBasePath && row.id !== undefined ? (
              <Link
                href={`${detailBasePath}/${row.id}`}
                className="font-bold text-slate-900 hover:text-blue-700"
              >
                {titleText}
              </Link>
            ) : (
              <span className="font-bold text-slate-900">{titleText}</span>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {row.id !== undefined ? `ID document : #${row.id}` : "Entrée API du moteur"}
            </p>
          </div>
        );
      },
    },
    ...fields.map<DataTableColumn<PaperlessResource>>((field) => ({
      header: field.label,
      cell: (row) => formatPaperlessValue(row[field.key]),
    })),
    {
      header: "Actions",
      className: "text-right",
      cell: (row) =>
        detailBasePath && row.id !== undefined ? (
          <Link
            href={`${detailBasePath}/${row.id}`}
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            Détail
          </Link>
        ) : (
          <span className="text-sm text-slate-400">Lecture</span>
        ),
    },
  ];

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

      {help ? <div className="mb-6">{help}</div> : null}

      {technicalNote ? (
        <div className="mb-6 rounded-2xl border border-blue-200/60 bg-blue-50/60 p-4 text-sm leading-6 text-blue-900 backdrop-blur">
          {technicalNote}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Entrées"
          value={count}
          helper="Résultat renvoyé par Gedify"
          icon={Database}
          tone="blue"
        />
        <StatCard
          label="Connexion"
          value={result.ok ? "OK" : "Erreur"}
          helper={result.ok ? "Endpoint accessible" : "Endpoint à connecter"}
          icon={Plug}
          tone={result.ok ? "emerald" : "amber"}
        />
        <StatCard
          label="Source"
          value="API"
          helper="Aucune base locale parallèle"
          icon={Sparkles}
          tone="violet"
        />
      </section>

      {!result.ok ? (
        <ErrorState title="Fonctionnalité Gedify à connecter" message={result.error} />
      ) : rows.length === 0 ? (
        <SectionCard bodyClassName="">
          <EmptyState
            title={emptyTitle ?? "Aucune entrée Gedify"}
            description={
              emptyDescription ??
              "La section existe dans la GED, mais aucun élément n'a encore été créé."
            }
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="">
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id ?? getResourceTitle(row)}
          />
        </SectionCard>
      )}
    </main>
  );
}

export function ResourceCards({ rows }: { rows: PaperlessResource[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <article
          key={String(row.id ?? getResourceTitle(row))}
          className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_8px_28px_-12px_rgba(15,23,42,0.10)] backdrop-blur"
        >
          <h3 className="text-base font-bold text-slate-900">{getResourceTitle(row)}</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {pickResourceSummary(row).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4">
                <dt className="font-semibold text-slate-500">{key}</dt>
                <dd className="break-words text-right font-semibold text-slate-800">
                  {formatPaperlessValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}
