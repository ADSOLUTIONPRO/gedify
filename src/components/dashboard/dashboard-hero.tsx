import type { ReactNode } from "react";
import { DocumentDashboardIllustration } from "@/components/illustrations/document-dashboard-illustration";

type DashboardHeroProps = {
  metrics: ReactNode;
};

export function DashboardHero({ metrics }: DashboardHeroProps) {
  return (
    <section
      className="relative overflow-hidden rounded-[22px]"
      style={{
        background: "linear-gradient(135deg, #0F1B31 0%, #14233C 55%, #1E2F4D 100%)",
        minHeight: "240px",
        padding: "36px",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      {/* Ambient glow rosé/violet (marque Gedify) */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 85% 35%, rgba(247,92,141,0.20) 0%, transparent 68%), radial-gradient(ellipse 50% 60% at 95% 90%, rgba(124,58,237,0.16) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: text + metrics */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-1" style={{ color: "rgba(247,150,185,0.95)" }}>
            Bonjour,
          </p>
          <h1 className="text-3xl font-extrabold text-white leading-tight lg:text-4xl">
            Bienvenue sur Gedify
          </h1>
          <p className="mt-2 text-base font-medium" style={{ color: "rgba(206,214,230,0.85)" }}>
            Votre centre de pilotage documentaire intelligent.
          </p>

          {/* Metrics row */}
          <div className="mt-6 flex flex-wrap gap-3">
            {metrics}
          </div>
        </div>

        {/* Right: illustration */}
        <div className="hidden lg:block shrink-0">
          <DocumentDashboardIllustration className="h-[200px] w-[260px]" />
        </div>
      </div>
    </section>
  );
}
