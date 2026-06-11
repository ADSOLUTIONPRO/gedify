import { Clock } from "lucide-react";
import { SaasPlaceholder } from "@/components/saas/saas-placeholder";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SaasPlaceholder
      label="Périodes d'essai"
      title="Périodes d'essai"
      icon={Clock}
      description="Gestion des essais gratuits : dates de fin, relances, conversion."
      bullets={["Suivi des essais en cours.", "Relances et conversion (à venir)."]}
    />
  );
}
