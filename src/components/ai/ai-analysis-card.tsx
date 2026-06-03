import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { AIConfidenceBadge } from "@/components/ai/ai-confidence-badge";
import { StatusPill } from "@/components/ui/status-pill";
import type { AIConfidence } from "@/lib/ai/types";

type Tone = "blue" | "violet" | "emerald" | "amber" | "rose" | "slate" | "orange";

type AiAnalysisCardProps = {
  title: string;
  subtitle?: string;
  statusLabel: string;
  statusTone: Tone;
  confidence?: AIConfidence;
  warnings?: number;
  href: string;
};

/**
 * Carte/ligne d'analyse réutilisée par les pages de liste de l'espace IA
 * (Documents analysés, Historique, Erreurs, Correspondants). Affiche le titre
 * métier, le statut, la confiance et un compteur de warnings — jamais de JSON
 * brut ni de donnée technique.
 */
export function AiAnalysisCard({ title, subtitle, statusLabel, statusTone, confidence, warnings = 0, href }: AiAnalysisCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition hover:-translate-y-0.5"
      style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>
          {title}
        </span>
        {subtitle ? (
          <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </span>
        ) : null}
      </span>

      {warnings > 0 ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--warning)" }}>
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {warnings}
        </span>
      ) : null}
      {confidence ? <AIConfidenceBadge confidence={confidence} /> : null}
      <StatusPill tone={statusTone} dot>
        {statusLabel}
      </StatusPill>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
