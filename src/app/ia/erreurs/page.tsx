import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Erreurs IA — Analyse IA" };

export default async function IAErreursPage() {
  const flagged = (await listAnalyses()).filter(
    (a) => Boolean(a.blockedAutoApplyReason) || (a.warnings?.length ?? 0) > 0
  );

  return (
    <SpaceLayout spaceId="ia">
      <p className="mb-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
        Analyses bloquées par les règles de cohérence ou comportant des avertissements. Aucune
        application automatique tant qu&apos;un humain n&apos;a pas validé.
      </p>

      {flagged.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Aucune erreur" description="Aucune analyse en échec contrôlé ou avec avertissement." />
      ) : (
        <div className="space-y-2">
          {flagged.map((a) => (
            <Link
              key={a.id}
              href={`/ia/document/${a.documentId}`}
              className="block rounded-xl border bg-white p-3 transition hover:-translate-y-0.5"
              style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--warning)" }} strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>
                  {a.suggestedTitle?.trim() || `Document #${a.documentId}`}
                </span>
                <span className="ml-auto shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {formatDate(a.updatedAt)}
                </span>
              </div>
              {a.blockedAutoApplyReason ? (
                <p className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium" style={{ background: "rgba(239,68,68,0.08)", color: "#B91C1C" }}>
                  {a.blockedAutoApplyReason}
                </p>
              ) : null}
              {(a.warnings ?? []).slice(0, 3).map((w, i) => (
                <p key={i} className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  • {w.message}
                </p>
              ))}
            </Link>
          ))}
        </div>
      )}
    </SpaceLayout>
  );
}
