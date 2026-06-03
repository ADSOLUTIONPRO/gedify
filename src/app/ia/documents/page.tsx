import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { AiAnalysisCard } from "@/components/ai/ai-analysis-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FileSearch } from "lucide-react";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import type { AIAnalysisStatus } from "@/lib/ai/types";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Documents analysés — Analyse IA" };

const STATUS: Record<AIAnalysisStatus, { label: string; tone: "amber" | "emerald" | "rose" | "slate" }> = {
  draft: { label: "Brouillon", tone: "slate" },
  "ready-to-validate": { label: "À valider", tone: "amber" },
  validated: { label: "Validé", tone: "emerald" },
  applied: { label: "Appliqué", tone: "emerald" },
  rejected: { label: "Rejeté", tone: "rose" },
};

export default async function IADocumentsPage() {
  const analyses = [...(await listAnalyses())].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));

  return (
    <SpaceLayout spaceId="ia">
      {analyses.length === 0 ? (
        <EmptyState icon={FileSearch} title="Aucun document analysé" description="Lancez une analyse depuis la vue d'ensemble pour alimenter cette liste." />
      ) : (
        <div className="space-y-2">
          {analyses.map((a) => {
            const s = STATUS[a.status];
            return (
              <AiAnalysisCard
                key={a.id}
                title={a.suggestedTitle?.trim() || `Document #${a.documentId}`}
                subtitle={`${a.detectedDocumentKind || "Document"} · analysé le ${formatDate(a.updatedAt)}`}
                statusLabel={s.label}
                statusTone={s.tone}
                confidence={a.confidence}
                warnings={a.warnings?.length ?? 0}
                href={`/ia/document/${a.documentId}`}
              />
            );
          })}
        </div>
      )}
    </SpaceLayout>
  );
}
