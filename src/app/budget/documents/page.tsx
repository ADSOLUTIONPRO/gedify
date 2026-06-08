import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Sparkles,
} from "lucide-react";
import { AIConfidenceBadge } from "@/components/ai/ai-confidence-badge";
import { FinancialExtractionReview } from "@/components/budget/financial-extraction-review";
import { FinancialItemQuickActions } from "@/components/budget/financial-item-quick-actions";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { InfoMetric } from "@/components/ui/info-metric";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { toBudgetMonth } from "@/lib/budget/budget-periods";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import {
  KIND_LABELS,
  STATUS_LABELS,
  type FinancialKind,
} from "@/lib/budget/financial-item-types";
import { formatMoney } from "@/lib/format-money";

export const dynamic = "force-dynamic";

const KIND_MAP: Record<string, FinancialKind> = {
  income: "revenue",
  expense: "expense",
  debt: "debt",
  refund: "refund",
  invoice: "expense",
  subscription: "subscription",
  due: "due_payment",
  allowance: "allowance",
  benefit: "benefit",
  tax: "tax",
  credit: "credit",
  loan: "loan",
  fees: "fee",
  other: "other",
};

export default async function FinancialDocumentsPage() {
  const [analyses, items] = await Promise.all([listAnalyses(), listFinancialItems()]);

  const toReview = items.filter(
    (item) => item.validationStatus === "needs_review" || item.status === "to_review",
  );
  const validated = items.filter((item) => item.validationStatus === "validated");
  const ignored = items.filter((item) => item.validationStatus === "ignored");

  const analysesWithFinancial = analyses.filter((entry) => entry.financialImpact.length > 0);
  const reviewedAnalysisIds = new Set(
    items
      .filter(
        (item) =>
          item.validationStatus === "validated" || item.validationStatus === "ignored",
      )
      .map((item) => item.sourceAnalysisId),
  );
  const toClassify = analysesWithFinancial.filter((a) => !reviewedAnalysisIds.has(a.id));

  return (
    <main className="p-4 lg:p-6">
      <PageHeader
        compact
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Documents financiers"
        description={`${toReview.length} item(s) auto-détectés à contrôler · ${validated.length} validés · ${ignored.length} ignorés.`}
      />

      <HelpCard
        compact
        tone="violet"
        icon={Sparkles}
        title="Auto-détection IA"
        description="Chaque document analysé crée automatiquement des items budgétaires en statut « À contrôler ». Validez-les en un clic ou modifiez-les avant validation. Aucun mouvement réel n'est appliqué."
        className="mb-4"
      />

      <section className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <InfoMetric
          label="À contrôler"
          value={toReview.length}
          helper="détectés par IA"
          icon={AlertTriangle}
          tone={toReview.length > 0 ? "amber" : "neutral"}
        />
        <InfoMetric
          label="Validés"
          value={validated.length}
          helper="ajoutés au budget"
          icon={CheckCircle2}
          tone="green"
        />
        <InfoMetric
          label="Ignorés"
          value={ignored.length}
          helper="non pertinents"
          icon={ExternalLink}
          tone="neutral"
        />
        <InfoMetric
          label="Analyses brutes"
          value={toClassify.length}
          helper="à classer manuellement"
          icon={FileText}
          tone="violet"
        />
      </section>

      <SectionCard
        icon={AlertTriangle}
        title={`Items à contrôler (${toReview.length})`}
        description="Auto-créés depuis les analyses IA en statut needs_review."
        bodyClassName=""
        className="mb-4"
      >
        {toReview.length === 0 ? (
          <div className="p-4">
            <CompactEmptyState
              icon={CheckCircle2}
              title="Tout est à jour"
              description="Aucun item budgétaire en attente de contrôle."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {toReview.map((item) => (
              <li key={item.id} className="p-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-semibold text-slate-800">{item.label}</span>
                      {item.aiConfidence ? (
                        <AIConfidenceBadge confidence={item.aiConfidence} />
                      ) : null}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{KIND_LABELS[item.kind]}</span>
                      {item.correspondentName ? (
                        <>
                          <span>·</span>
                          <span>{item.correspondentName}</span>
                        </>
                      ) : null}
                      {item.budgetMonth ? (
                        <>
                          <span>·</span>
                          <span>{item.budgetMonth}</span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span className="text-amber-700">{STATUS_LABELS[item.status]}</span>
                      {item.sourceDocumentId ? (
                        <>
                          <span>·</span>
                          <Link
                            href={`/ia/document/${item.sourceDocumentId}`}
                            className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:underline"
                          >
                            Document
                            <ArrowRight
                              className="h-3 w-3"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-sm font-bold text-slate-900">
                      {formatMoney(item.amount, item.currency)}
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <FinancialItemQuickActions itemId={item.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        icon={FileText}
        title={`Analyses brutes à classer (${toClassify.length})`}
        description="Documents analysés dont les impacts n'ont pas encore été classés (cas legacy ou avant auto-création)."
        bodyClassName=""
      >
        {toClassify.length === 0 ? (
          <div className="p-4">
            <CompactEmptyState
              icon={FileText}
              title="Aucune analyse à classer"
              description="Tous les documents analysés sont soit validés, soit ignorés."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {toClassify.map((analysis) => (
              <li key={analysis.id} className="p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/ia/document/${analysis.documentId}`}
                      className="text-sm font-bold text-slate-900 hover:text-blue-700"
                    >
                      {analysis.detectedDocumentKind} · Document #{analysis.documentId}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                      {analysis.summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AIConfidenceBadge confidence={analysis.confidence} />
                    <Link
                      href={`/ia/document/${analysis.documentId}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Fiche Doc
                      <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
                <div className="grid gap-2.5 md:grid-cols-2">
                  {analysis.financialImpact.map((impact, index) => {
                    const suggestedKind = KIND_MAP[impact.kind] ?? "other";
                    const documentDate =
                      analysis.detectedDates.find((d) =>
                        /date|émission|document/i.test(d.label),
                      )?.iso ?? null;
                    const dueDate =
                      impact.dueDate ??
                      analysis.detectedDates.find((d) =>
                        /échéance|limite|paiement/i.test(d.label),
                      )?.iso ??
                      null;
                    const budgetMonth =
                      (dueDate
                        ? toBudgetMonth(dueDate)
                        : documentDate
                          ? toBudgetMonth(documentDate)
                          : toBudgetMonth(new Date())) ?? "";
                    return (
                      <FinancialExtractionReview
                        key={index}
                        analysisId={analysis.id}
                        impactIndex={index}
                        impact={impact}
                        suggestedKind={suggestedKind}
                        suggestedBudgetMonth={budgetMonth}
                        suggestedDueDate={dueDate}
                        suggestedDocumentDate={documentDate}
                        suggestedLabel={
                          impact.creditor
                            ? `${analysis.detectedDocumentKind} · ${impact.creditor}`
                            : analysis.detectedDocumentKind
                        }
                        suggestedCorrespondentName={
                          impact.creditor ?? analysis.suggestedCorrespondentName
                        }
                      />
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </main>
  );
}
