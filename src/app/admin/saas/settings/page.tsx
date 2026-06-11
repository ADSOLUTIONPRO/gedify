import { Settings } from "lucide-react";
import { SaasPlaceholder } from "@/components/saas/saas-placeholder";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SaasPlaceholder
      label="Paramètres SaaS"
      title="Paramètres SaaS"
      icon={Settings}
      description="Réglages globaux : inscription ouverte/fermée, mode invitation, e-mail système, limites par défaut."
      bullets={[
        "Inscription publique fermée (par défaut).",
        "Mode invitation, e-mail système et limites par défaut (à venir).",
      ]}
    />
  );
}
