import { AlertTriangle, ListChecks, Mail, ScrollText } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

type ActivityKpiCardsProps = {
  paperlessLogs: number;
  paperlessTasks: number;
  mailImports: number;
  alerts: number;
};

export function ActivityKpiCards({
  paperlessLogs,
  paperlessTasks,
  mailImports,
  alerts,
}: ActivityKpiCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Journaux Gedify"
        value={paperlessLogs}
        helper="Documents indexés"
        icon={ScrollText}
        tone="blue"
      />
      <StatCard
        label="Tâches récentes"
        value={paperlessTasks}
        helper="En cours / terminées"
        icon={ListChecks}
        tone="violet"
      />
      <StatCard
        label="Imports mail"
        value={mailImports}
        helper="20 derniers événements"
        icon={Mail}
        tone="emerald"
      />
      <StatCard
        label="Erreurs / alertes"
        value={alerts}
        helper={alerts === 0 ? "Aucune" : "À traiter"}
        icon={AlertTriangle}
        tone={alerts === 0 ? "slate" : "amber"}
      />
    </div>
  );
}
