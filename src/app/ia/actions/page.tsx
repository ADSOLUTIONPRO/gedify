import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";

export const dynamic = "force-dynamic";

export default async function AIActionsPage() {
  const analyses = await listAnalyses();
  const recommendations = analyses
    .flatMap((analysis) =>
      analysis.recommendedActions.map((action) => ({
        ...action,
        analysisId: analysis.id,
        documentId: analysis.documentId,
        documentKind: analysis.detectedDocumentKind,
        confidence: analysis.confidence,
      })),
    )
    .sort((a, b) => {
      const order: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      const aRank = order[a.priority ?? "normal"] ?? 2;
      const bRank = order[b.priority ?? "normal"] ?? 2;
      if (aRank !== bRank) return aRank - bRank;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/ia", label: "IA" }}
        eyebrow="Intelligence"
        title="Actions recommandées"
        description="Liste des actions proposées par l'IA. Ouvrez le document pour transformer ces propositions en vraies tâches."
      />

      <div className="mb-6">
        <HelpCard
          tone="violet"
          icon={Zap}
          title="Recommandations IA"
          description="Ces actions ne sont pas encore enregistrées comme tâches. Validez-les dans /ia/document/[id] pour les pousser vers le module Actions."
        />
      </div>

      {recommendations.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Zap}
            title="Aucune action recommandée"
            description="Lancez une analyse IA pour générer des recommandations."
          />
        </SectionCard>
      ) : (
        <SectionCard icon={Zap} title={`${recommendations.length} action(s) recommandée(s)`} bodyClassName="">
          <ul className="divide-y divide-slate-100">
            {recommendations.map((action) => (
              <li key={`${action.analysisId}-${action.id}`} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{action.title}</p>
                    <p className="text-xs text-slate-500">
                      {action.documentKind} · Document #{action.documentId}
                    </p>
                  </div>
                  <Link
                    href={`/ia/document/${action.documentId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"
                  >
                    Ouvrir la fiche
                    <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </main>
  );
}
