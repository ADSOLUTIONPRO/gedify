import type { Metadata } from "next";
import Link from "next/link";
import { SpaceLayout } from "@/components/layout/space-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, UserPlus, Users } from "lucide-react";
import { AIConfidenceBadge } from "@/components/ai/ai-confidence-badge";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { buildCorrespondentSuggestion, type CorrespondentSuggestionStatus } from "@/lib/ai/correspondent-suggestions";
import { getCorrespondents } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Correspondants IA — Analyse IA" };

const STATUS_META: Record<CorrespondentSuggestionStatus, { label: string; color: string }> = {
  existing_match: { label: "Correspondant existant", color: "#16A34A" },
  possible_match: { label: "Correspondance possible", color: "#F59E0B" },
  new_correspondent: { label: "Nouveau à créer", color: "#7C3AED" },
  uncertain: { label: "Incertain", color: "#64748B" },
};

export default async function IACorrespondantsPage() {
  const [analyses, correspondentsData] = await Promise.all([listAnalyses(), getCorrespondents()]);
  const correspondents = correspondentsData.results ?? [];
  const suggestions = analyses
    .filter((a) => a.status === "ready-to-validate" && Boolean(a.suggestedCorrespondentName))
    .map((a) => ({ analysis: a, suggestion: buildCorrespondentSuggestion(a, correspondents) }));

  return (
    <SpaceLayout spaceId="ia">
      <p className="mb-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
        Correspondants proposés par l&apos;IA. Confirmez l&apos;existant, choisissez une correspondance
        proche ou créez un nouveau correspondant — toujours sur preuve OCR.
      </p>

      {suggestions.length === 0 ? (
        <EmptyState icon={Users} title="Aucun correspondant proposé" description="Les correspondants détectés à valider apparaîtront ici." />
      ) : (
        <div className="space-y-2">
          {suggestions.map(({ analysis, suggestion }) => {
            const meta = STATUS_META[suggestion.status];
            return (
              <Link
                key={analysis.id}
                href={`/ia/document/${analysis.documentId}`}
                className="block rounded-xl border bg-white p-3 transition hover:-translate-y-0.5"
                style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${meta.color}14`, color: meta.color }}>
                    {suggestion.status === "new_correspondent" ? <UserPlus className="h-4 w-4" strokeWidth={1.75} /> : <Users className="h-4 w-4" strokeWidth={1.75} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>
                      {suggestion.detectedName}
                    </span>
                    <span className="block truncate text-[11.5px]" style={{ color: meta.color }}>
                      {meta.label}
                      {suggestion.existingMatch ? ` → ${suggestion.existingMatch.name}` : ""}
                      {!suggestion.existingMatch && suggestion.closeMatches.length > 0 ? ` (proche : ${suggestion.closeMatches[0].name})` : ""}
                    </span>
                  </span>
                  {suggestion.confidence ? <AIConfidenceBadge confidence={suggestion.confidence} /> : null}
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" strokeWidth={2} aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </SpaceLayout>
  );
}
