import type { LucideIcon } from "lucide-react";
import { SetupStepCard, type SetupStepStatus } from "@/components/setup/setup-step-card";

export type SetupStep = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  status: SetupStepStatus;
  icon: LucideIcon;
};

export function SetupChecklist({ steps, compact = false }: { steps: SetupStep[]; compact?: boolean }) {
  const visibleSteps = compact
    ? steps.filter((step) => step.status !== "done").slice(0, 4)
    : steps;

  return (
    <div className="grid gap-2">
      {visibleSteps.map((step) => (
        <SetupStepCard key={step.title} {...step} />
      ))}
    </div>
  );
}
