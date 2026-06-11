import { AlertTriangle } from "lucide-react";
import { SaasPlaceholder } from "@/components/saas/saas-placeholder";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SaasPlaceholder
      label="Sécurité clients"
      title="Sécurité clients"
      icon={AlertTriangle}
      description="Événements de sécurité par tenant : connexions, échecs, actions sensibles, suspensions."
      bullets={["Audit déjà journalisé (tenant_created/updated/suspended…).", "Vue consolidée par tenant (à venir)."]}
    />
  );
}
