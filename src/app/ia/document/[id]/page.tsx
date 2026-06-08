import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Coins,
  ExternalLink,
  Eye,
  FileText,
  ScanText,
  Zap,
} from "lucide-react";
import { AnalyzeDocumentButton } from "@/components/ai/analyze-document-button";
import { DocumentOcrInfo } from "@/components/documents/document-ocr-info";
import { AIConfidenceBadge } from "@/components/ai/ai-confidence-badge";
import { EntitySuggestionPanel } from "@/components/ai/entity-suggestion-panel";
import { AIValidationPanel } from "@/components/ai/ai-validation-panel";
import { AIWarningsPanel } from "@/components/ai/ai-warnings-panel";
import { PaySlipDetailPanel } from "@/components/ai/pay-slip-detail-panel";
import { DetectedInfoEditableList } from "@/components/ai/detected-info-editable-list";
import { FinancialExtractionReview } from "@/components/budget/financial-extraction-review";
import { bulkUpsertFromSynthesis } from "@/lib/ai/detected-info-store";
import { synthesizeDetectedInfos } from "@/lib/ai/detected-info-utils";
import { DocumentPreview } from "@/components/ui/document-preview";
import { DocumentPreviewButton } from "@/components/documents/document-preview-button";
import { toBudgetMonth } from "@/lib/budget/budget-periods";
import type { FinancialKind } from "@/lib/budget/financial-item-types";
import { ErrorState } from "@/components/ui/error-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";
import { runDocumentAnalysis } from "@/lib/ai/run-document-analysis";
import { getDocument, getPaperlessPublicUrl } from "@/lib/paperless";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DocumentAnalysisPage({ params }: Props) {
  const { id } = await params;
  const documentId = Number(id);

  if (!Number.isFinite(documentId)) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          backLink={{ href: "/ia", label: "IA" }}
          eyebrow="Analyse IA"
          title="Document introuvable"
        />
        <ErrorState message="Identifiant invalide." />
      </main>
    );
  }

  let document;
  try {
    document = await getDocument(documentId);
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          backLink={{ href: "/ia", label: "IA" }}
          eyebrow="Analyse IA"
          title={`Document #${documentId}`}
        />
        <ErrorState
          title="Document Gedify inaccessible"
          message={error instanceof Error ? error.message : String(error)}
        />
      </main>
    );
  }

  // Load the latest stored analysis. If none exists, trigger a first analysis.
  // Never auto-trigger re-analysis for stale mock analyses — user must click
  // "Re-analyser" manually to avoid concurrent Ollama calls.
  let analysis = await getLatestAnalysisForDocument(documentId);

  if (!analysis) {
    const outcome = await runDocumentAnalysis(documentId, { force: false, createFinancialItems: false });
    if (outcome.status === "ok" || outcome.status === "cached") {
      analysis = outcome.analysis;
    } else if (outcome.status === "no-ocr") {
      return (
        <main className="p-4 lg:p-8">
          <PageHeader
            backLink={{ href: "/ia", label: "IA" }}
            eyebrow={`Analyse IA · Document #${documentId}`}
            title={document.title || `Document #${documentId}`}
          />

          {/* Ce n'est PAS une erreur : l'OCR n'a simplement pas encore produit de texte. */}
          <div className="max-w-2xl space-y-4">
            <div
              className="flex items-start gap-3 rounded-2xl border p-4"
              style={{ borderColor: "var(--gedify-orange)", background: "var(--gedify-orange-soft)" }}
            >
              <ScanText className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" strokeWidth={1.75} aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                  OCR pas encore réalisé
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  L&apos;analyse IA a besoin du texte du document, mais l&apos;OCR n&apos;a pas encore
                  extrait de contenu exploitable. Lancez l&apos;OCR (ou attendez qu&apos;il se termine),
                  puis <strong>relancez l&apos;analyse</strong> une fois le document reconnu. Ce
                  n&apos;est pas une erreur d&apos;analyse.
                </p>
              </div>
            </div>

            <SectionCard icon={ScanText} title="État de l'OCR">
              <DocumentOcrInfo documentId={documentId} />
            </SectionCard>

            <div className="flex flex-wrap items-center gap-2">
              <AnalyzeDocumentButton documentId={documentId} force label="Relancer l'analyse IA" />
              <Link
                href={`/documents/${documentId}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Détail document
              </Link>
            </div>
          </div>
        </main>
      );
    } else {
      return (
        <main className="p-4 lg:p-8">
          <PageHeader
            backLink={{ href: "/ia", label: "IA" }}
            eyebrow={`Analyse IA · Document #${documentId}`}
            title={document.title || `Document #${documentId}`}
          />
          <ErrorState
            title="Analyse IA impossible"
            message={outcome.status === "error" ? outcome.message : "Erreur inconnue."}
          />
        </main>
      );
    }
  }

  // Persist detected pieces in the editable store so the user can correct/validate each one.
  await bulkUpsertFromSynthesis(synthesizeDetectedInfos(analysis));

  const paperlessUrl = getPaperlessPublicUrl();
  const fileName = document.original_file_name ?? document.original_filename ?? document.filename;
  const mimeType = document.mime_type ?? null;

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/ia", label: "IA" }}
        eyebrow={`Analyse IA · Document #${documentId}`}
        title={document.title || `Document #${documentId}`}
        description={analysis.summary || "Synthèse en cours de génération."}
        actions={
          <>
            <DocumentPreviewButton
              documentId={documentId}
              title={document.title || `Document #${documentId}`}
              triggerClassName="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Aperçu du document
            </DocumentPreviewButton>
            <Link
              href={`/documents/${documentId}`}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Détail document
            </Link>
            {paperlessUrl ? (
              <a
                href={`${paperlessUrl}/documents/${documentId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Ouvrir le document
              </a>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <AIConfidenceBadge confidence={analysis.confidence} />
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
          Statut : {analysis.status}
        </span>
        {analysis.urgency === "urgent" || analysis.urgency === "important" ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              analysis.urgency === "urgent"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {analysis.urgency === "urgent" ? "Urgent" : "Important"}
          </span>
        ) : null}
      </div>

      <div className="mb-6">
        <AIWarningsPanel
          warnings={analysis.warnings}
          autoApplyEligible={analysis.autoApplyEligible}
          blockedReason={analysis.blockedAutoApplyReason}
          ruleMatches={analysis.ruleMatches}
          originalSuggestion={analysis.originalSuggestion}
          currentCorrespondent={analysis.suggestedCorrespondentName}
        />
      </div>

      <div className="mb-6">
        <AIValidationPanel analysis={analysis} />
      </div>

      {analysis.richData ? (
        <div className="mb-6">
          <SectionCard icon={Brain} title="Données structurées extraites">
            <PaySlipDetailPanel
              documentId={documentId}
              analysisId={analysis.id}
              richData={analysis.richData}
              suggestedCorrespondentName={analysis.suggestedCorrespondentName}
            />
          </SectionCard>
        </div>
      ) : null}

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <DocumentPreviewButton
          documentId={documentId}
          title={document.title || `Document #${documentId}`}
          triggerClassName="group relative mx-auto block w-full cursor-zoom-in rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <DocumentPreview
            documentId={documentId}
            title={document.title}
            fileName={fileName}
            mimeType={mimeType}
            size="lg"
          />
          <span className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 rounded-xl bg-slate-950/72 py-1.5 text-[11.5px] font-semibold text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
            <Eye className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Agrandir
          </span>
        </DocumentPreviewButton>
        <div className="space-y-4">
          <HelpCard
            tone="blue"
            icon={Brain}
            title={analysis.detectedDocumentKind}
            description={analysis.plainLanguageExplanation}
          />
          <SectionCard icon={Brain} title="Classement proposé">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Row label="Correspondant" value={analysis.suggestedCorrespondentName} />
              <Row label="Type Gedify" value={analysis.suggestedDocumentTypeName} />
              <Row
                label="Tags suggérés"
                value={
                  analysis.suggestedTagNames.length > 0 ? analysis.suggestedTagNames.join(", ") : "—"
                }
              />
              <Row label="Urgence" value={analysis.urgency} />
            </dl>
          </SectionCard>

          <SectionCard icon={Brain} title="Appliquer les suggestions">
            <EntitySuggestionPanel
              documentId={documentId}
              currentTagIds={document.tags ?? []}
            />
          </SectionCard>
        </div>
      </div>

      <div className="mb-6">
        <DetectedInfoEditableList
          documentId={documentId}
          analysisId={analysis.id}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard icon={Zap} title="Actions recommandées">
          {analysis.recommendedActions.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune action recommandée par l&apos;IA.</p>
          ) : (
            <ul className="space-y-2.5">
              {analysis.recommendedActions.map((action) => (
                <li
                  key={action.id}
                  className="rounded-2xl border border-slate-200/60 bg-white/70 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{action.title}</p>
                      {action.description ? (
                        <p className="mt-0.5 text-xs text-slate-500">{action.description}</p>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        action.priority === "urgent"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : action.priority === "high"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {action.priority ?? "normal"}
                    </span>
                  </div>
                  {action.dueDate ? (
                    <p className="mt-1 text-xs font-medium text-blue-700">
                      Échéance : {new Date(action.dueDate).toLocaleDateString("fr-FR")}
                    </p>
                  ) : null}
                  {action.amount ? (
                    <p className="text-xs font-medium text-slate-700">
                      Montant : {action.amount.toFixed(2)} €
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon={Coins}
          title="Impact budget détecté"
          description={
            analysis.financialImpact.length === 0
              ? "Aucun montant pertinent détecté."
              : "Validez ou modifiez chaque montant avant ajout au budget."
          }
        >
          {analysis.financialImpact.length === 0 ? (
            <p className="text-sm text-slate-500">
              L&apos;IA n&apos;a pas identifié de revenu, dépense ou dette dans ce document.
            </p>
          ) : (
            <div className="space-y-2.5">
              {analysis.financialImpact.map((impact, index) => {
                const kindMap: Record<string, FinancialKind> = {
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
                const suggestedKind = kindMap[impact.kind] ?? "other";
                const documentDate =
                  analysis.detectedDates.find((d) => /date|émission|document/i.test(d.label))
                    ?.iso ?? null;
                const dueDate =
                  impact.dueDate ??
                  analysis.detectedDates.find((d) => /échéance|limite|paiement/i.test(d.label))
                    ?.iso ??
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
                    documentTitle={document.title}
                  />
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-500">
        <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        Toutes les actions de cette page nécessitent votre validation. Aucune modification automatique
        n&apos;est appliquée.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}
