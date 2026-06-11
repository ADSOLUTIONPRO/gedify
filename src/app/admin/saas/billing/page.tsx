import { Receipt } from "lucide-react";
import { SaasPlaceholder } from "@/components/saas/saas-placeholder";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SaasPlaceholder
      label="Facturation"
      title="Facturation"
      icon={Receipt}
      description="Factures, paiements, montants et échéances par client."
      bullets={["Vue globale des factures et paiements.", "Branché à Stripe (à venir)."]}
    />
  );
}
