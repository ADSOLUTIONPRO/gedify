import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { AiBatchActions } from "@/components/ai/ai-batch-actions";
import { AiOverview, type AiOverviewCounts, type RecentAnalysisVM } from "@/components/ai/ai-overview";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { getActiveAIProvider } from "@/lib/ai/ai-provider";
import { getDocuments } from "@/lib/paperless";
import type { AIAnalysisStatus } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Analyse IA — Gedify" };

const STATUS_LABEL: Record<AIAnalysisStatus, string> = {
  draft: "Brouillon",
  "ready-to-validate": "À valider",
  validated: "Validé",
  rejected: "Rejeté",
  applied: "Appliqué",
};

export default async function IAOverviewPage() {
  const [analyses, recentDocuments] = await Promise.all([
    listAnalyses(),
    getDocuments({ page_size: 20, ordering: "-added" }).catch(() => null),
  ]);
  const provider = getActiveAIProvider();

  const counts: AiOverviewCounts = {
    toValidate: analyses.filter((a) => a.status === "ready-to-validate").length,
    applied: analyses.filter((a) => a.status === "applied" || a.status === "validated").length,
    errors: analyses.filter((a) => Boolean(a.blockedAutoApplyReason) || (a.warnings?.length ?? 0) > 0).length,
    financial: analyses.filter((a) => a.financialImpact.length > 0).length,
    correspondents: analyses.filter((a) => a.status === "ready-to-validate" && Boolean(a.suggestedCorrespondentName)).length,
    actions: analyses.filter((a) => a.recommendedActions.length > 0).length,
  };

  const analyzedIds = new Set(analyses.map((a) => a.documentId));
  const pendingCount = recentDocuments?.results?.filter((d) => !analyzedIds.has(d.id)).length ?? 0;

  const recent: RecentAnalysisVM[] = [...analyses]
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      title: a.suggestedTitle?.trim() || `Document #${a.documentId}`,
      statusLabel: STATUS_LABEL[a.status],
      confidence: a.confidence,
      href: `/ia/document/${a.documentId}`,
    }));

  return (
    <SpaceLayout spaceId="ia" actions={<AiBatchActions pendingCount={pendingCount} />}>
      <AiOverview
        counts={counts}
        pendingCount={pendingCount}
        recent={recent}
        providerLabel={provider.name}
        providerIsMock={provider.isMock}
      />
    </SpaceLayout>
  );
}
