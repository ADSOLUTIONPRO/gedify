import type { Metadata } from "next";
import Link from "next/link";
import { SpaceLayout } from "@/components/layout/space-layout";
import { AiAnalysisCard } from "@/components/ai/ai-analysis-card";
import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import type { AIAnalysisStatus } from "@/lib/ai/types";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Historique — Analyse IA" };

const STATUS: Record<AIAnalysisStatus, { label: string; tone: "amber" | "emerald" | "rose" | "slate" }> = {
  draft: { label: "Brouillon", tone: "slate" },
  "ready-to-validate": { label: "À valider", tone: "amber" },
  validated: { label: "Validé", tone: "emerald" },
  applied: { label: "Appliqué", tone: "emerald" },
  rejected: { label: "Rejeté", tone: "rose" },
};

export default async function IAHistoriquePage() {
  const analyses = [...(await listAnalyses())]
    .filter((a) => a.status !== "ready-to-validate")
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));

  return (
    <SpaceLayout spaceId="ia">
      <p className="mb-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
        Historique des analyses validées, appliquées ou rejetées. Les corrections utilisateur sont conservées et prioritaires.
      </p>
      {analyses.length === 0 ? (
        <EmptyState
          icon={History}
          title="Aucun historique"
          description="Les analyses validées ou rejetées apparaîtront ici."
        />
      ) : (
        <div className="space-y-2">
          {analyses.map((a) => {
            const s = STATUS[a.status];
            return (
              <AiAnalysisCard
                key={a.id}
                title={a.suggestedTitle?.trim() || `Document #${a.documentId}`}
                subtitle={`${s.label} · ${formatDate(a.updatedAt)} · ${a.provider}`}
                statusLabel={s.label}
                statusTone={s.tone}
                href={`/ia/document/${a.documentId}`}
              />
            );
          })}
        </div>
      )}
      <Link href="/ia/classement" className="mt-4 inline-block text-[12.5px] font-semibold" style={{ color: "var(--violet)" }}>
        Aller à la validation rapide →
      </Link>
    </SpaceLayout>
  );
}
