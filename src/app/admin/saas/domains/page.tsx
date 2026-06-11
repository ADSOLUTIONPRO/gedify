import { Link2 } from "lucide-react";
import { SaasPlaceholder } from "@/components/saas/saas-placeholder";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SaasPlaceholder
      label="Domaines clients"
      title="Domaines clients"
      icon={Link2}
      description="Sous-domaines client.gedify.fr et domaines personnalisés (DNS/SSL)."
      bullets={[
        "Résolution par sous-domaine préparée (resolveTenantFromHost) mais non active.",
        "Statut DNS/SSL et domaines personnalisés (à venir).",
      ]}
    />
  );
}
