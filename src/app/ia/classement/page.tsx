import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { IaAnalysisListClient } from "@/components/ai/ia-analysis-list-client";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import type { AIAnalysis } from "@/lib/ai/types";
import { listFinancialItems } from "@/lib/budget/financial-item-store";

export const dynamic = "force-dynamic";

type FilterKey = "all" | "needs_review" | "ready" | "validated" | "rejected" | "applied";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "Toutes",
  needs_review: "À contrôler",
  ready: "Prêt à valider",
  validated: "Validées",
  rejected: "Rejetées",
  applied: "Appliquées",
};

const PIPELINE_STEPS = [
  { key: "extraction", label: "Extraction OCR", description: "Texte du document récupéré." },
  { key: "comprehension", label: "Compréhension", description: "Détection du type et du contenu clé." },
  { key: "classification", label: "Classement", description: "Suggestion correspondant / type / tags." },
  { key: "validation", label: "Validation humaine", description: "Vous validez ou ajustez la suggestion." },
  { key: "application", label: "Application", description: "Synchronisation avec Gedify." },
] as const;

export default async function ClassementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const active: FilterKey = ((["all", "needs_review", "ready", "validated", "rejected", "applied"] as const).includes(
    params.status as FilterKey
  )
    ? (params.status as FilterKey)
    : "needs_review") as FilterKey;

  const [analyses, items] = await Promise.all([listAnalyses(), listFinancialItems()]);

  const needsReviewIds = new Set(
    items
      .filter((item) => item.validationStatus === "needs_review")
      .map((item) => item.sourceAnalysisId)
      .filter((id): id is string => Boolean(id))
  );

  function bucketOf(analysis: AIAnalysis): FilterKey {
    if (analysis.status === "applied") return "applied";
    if (analysis.status === "validated") return "validated";
    if (analysis.status === "rejected") return "rejected";
    if (needsReviewIds.has(analysis.id)) return "needs_review";
    return "ready";
  }

  const counts: Record<FilterKey, number> = {
    all: analyses.length,
    needs_review: 0,
    ready: 0,
    validated: 0,
    rejected: 0,
    applied: 0,
  };
  for (const a of analyses) {
    counts[bucketOf(a)] += 1;
  }

  const filtered =
    active === "all" ? analyses : analyses.filter((a) => bucketOf(a) === active);

  const tabs = [
    { href: "/ia/classement?status=needs_review", label: "À contrôler", count: counts.needs_review },
    { href: "/ia/classement?status=ready", label: "Prêt à valider", count: counts.ready },
    { href: "/ia/classement?status=validated", label: "Validées", count: counts.validated },
    { href: "/ia/classement?status=applied", label: "Appliquées", count: counts.applied },
    { href: "/ia/classement?status=rejected", label: "Rejetées", count: counts.rejected },
    { href: "/ia/classement?status=all", label: "Toutes", count: counts.all },
  ];
  const activeHref = `/ia/classement?status=${active}`;

  const recentActivity = [...analyses]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5);

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/ia", label: "Analyse IA" },
          { label: "Classement IA" },
        ]}
        title="Classement IA"
        description="Centre de contrôle des analyses IA. Validez, ajustez ou rejetez les propositions de classement et les impacts budget détectés."
        actions={
          <>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <Filter className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Filtres
            </button>
            <Link
              href="/ia"
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--blue-600)" }}
            >
              <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Voir l&apos;analyse IA
            </Link>
          </>
        }
      />

      <SegmentedTabs tabs={tabs} activeHref={activeHref} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        {/* Left: analysis list */}
        <SectionCard
          title={FILTER_LABELS[active]}
          description={`${filtered.length} analyse(s) affichée(s)`}
          bodyClassName="p-0"
        >
          <div className="p-4">
            <IaAnalysisListClient
              analyses={filtered.map((a) => ({
                id: a.id,
                documentId: a.documentId,
                bucket: bucketOf(a) as "all" | "needs_review" | "ready" | "validated" | "rejected" | "applied",
                suggestedTitle: a.suggestedTitle,
                detectedDocumentKind: a.detectedDocumentKind,
                summary: a.summary,
                confidence: a.confidence,
                suggestedCorrespondentName: a.suggestedCorrespondentName,
                suggestedDocumentTypeName: a.suggestedDocumentTypeName,
                suggestedTagNames: a.suggestedTagNames,
                financialImpactCount: a.financialImpact.length,
                warnings: a.warnings ?? [],
                autoApplyEligible: a.autoApplyEligible,
                blockedAutoApplyReason: a.blockedAutoApplyReason,
                ruleMatches: a.ruleMatches,
                originalSuggestion: a.originalSuggestion,
              }))}
            />
          </div>
        </SectionCard>

        {/* Right rail */}
        <aside className="space-y-5">
          <RightRailCard
            title="Pipeline d'analyse"
            icon={Sparkles}
            iconTone="violet"
          >
            <ol className="space-y-2">
              {PIPELINE_STEPS.map((step, index) => (
                <li key={step.key} className="flex items-start gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      background: "rgba(11,92,255,0.10)",
                      color: "var(--blue-600)",
                    }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {step.label}
                    </p>
                    <p
                      className="mt-0.5 text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </RightRailCard>

          <RightRailCard
            title="Statistique d'analyse"
            icon={TrendingUp}
            iconTone="emerald"
          >
            <div className="space-y-2.5">
              <Row
                icon={<AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />}
                tone="amber"
                label="À contrôler"
                value={counts.needs_review}
              />
              <Row
                icon={<Clock className="h-3.5 w-3.5" strokeWidth={1.75} />}
                tone="blue"
                label="Prêt à valider"
                value={counts.ready}
              />
              <Row
                icon={<CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />}
                tone="emerald"
                label="Validées"
                value={counts.validated}
              />
              <Row
                icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />}
                tone="violet"
                label="Appliquées"
                value={counts.applied}
              />
              <Row
                icon={<XCircle className="h-3.5 w-3.5" strokeWidth={1.75} />}
                tone="rose"
                label="Rejetées"
                value={counts.rejected}
              />
            </div>
          </RightRailCard>

          <RightRailCard
            title="Fil d'usage"
            icon={ChevronRight}
            iconTone="blue"
            ctaHref="/journaux"
            ctaLabel="Voir tout"
            bodyClassName="space-y-2"
          >
            {recentActivity.length === 0 ? (
              <p className="py-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Aucune analyse récente.
              </p>
            ) : (
              recentActivity.map((a) => (
                <Link
                  key={a.id}
                  href={`/ia/document/${a.documentId}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-xs transition hover:bg-slate-50"
                >
                  <span className="truncate font-semibold" style={{ color: "var(--text-main)" }}>
                    Doc #{a.documentId}
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </Link>
              ))
            )}
          </RightRailCard>
        </aside>
      </div>
    </PageShell>
  );
}

function Row({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "blue" | "amber" | "emerald" | "violet" | "rose";
  label: string;
  value: number;
}) {
  const PALETTE: Record<typeof tone, { bg: string; color: string }> = {
    blue: { bg: "rgba(11,92,255,0.08)", color: "#0B5CFF" },
    amber: { bg: "rgba(245,158,11,0.10)", color: "#B45309" },
    emerald: { bg: "rgba(16,163,74,0.08)", color: "#16A34A" },
    violet: { bg: "rgba(124,58,237,0.10)", color: "#7C3AED" },
    rose: { bg: "rgba(239,68,68,0.08)", color: "#DC2626" },
  };
  const p = PALETTE[tone];
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="inline-flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: p.bg, color: p.color }}
        >
          {icon}
        </span>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
      </span>
      <span className="font-bold" style={{ color: "var(--text-main)" }}>
        {value}
      </span>
    </div>
  );
}
