import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AIOrbIllustration } from "@/components/illustrations/ai-orb";

type AIInsightsMetric = {
  label: string;
  value: number | string;
  color?: string;
};

type AIInsightsCardProps = {
  metrics: AIInsightsMetric[];
};

export function AIInsightsCard({ metrics }: AIInsightsCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(160deg, #061B4A 0%, #082060 50%, #0A2875 100%)",
        border: "1px solid rgba(43,123,255,0.25)",
        boxShadow: "0 0 40px -10px rgba(43,123,255,0.25), 0 8px 32px -8px rgba(6,19,38,0.5)",
      }}
    >
      {/* Glow */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-40 w-40"
        aria-hidden="true"
        style={{ background: "radial-gradient(circle at 80% 20%, rgba(43,123,255,0.3) 0%, transparent 60%)" }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white">Analyse IA</h3>
            <p className="mt-0.5 text-xs" style={{ color: "rgba(130,170,230,0.8)" }}>
              Vos insights documentaires
            </p>
          </div>
          <Link
            href="/ia"
            className="text-xs font-semibold transition-colors hover:text-white"
            style={{ color: "rgba(100,155,230,0.8)" }}
          >
            Voir tous →
          </Link>
        </div>

        {/* Orb illustration */}
        <div className="my-4 flex justify-center">
          <AIOrbIllustration className="h-[90px] w-[90px]" />
        </div>

        {/* Metrics */}
        <div className="space-y-2.5">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-sm font-medium" style={{ color: "rgba(180,210,255,0.9)" }}>
                {metric.label}
              </span>
              <span className="text-lg font-bold text-white">{metric.value}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/ia"
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--blue-600)" }}
        >
          Accéder à l&apos;analyse IA
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
