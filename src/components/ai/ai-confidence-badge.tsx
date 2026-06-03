import type { AIConfidence } from "@/lib/ai/types";

const TONE: Record<AIConfidence, string> = {
  low: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const LABEL: Record<AIConfidence, string> = {
  low: "Confiance faible",
  medium: "Confiance moyenne",
  high: "Confiance élevée",
};

export function AIConfidenceBadge({ confidence }: { confidence: AIConfidence }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[confidence]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABEL[confidence]}
    </span>
  );
}
