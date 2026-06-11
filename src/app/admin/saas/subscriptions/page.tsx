import { Repeat } from "lucide-react";
import { SaasPlaceholder } from "@/components/saas/saas-placeholder";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SaasPlaceholder
      label="Abonnements"
      title="Abonnements"
      icon={Repeat}
      description="Liste des abonnements clients et leur cycle de vie."
      bullets={[
        "Statuts prévus : trialing, active, past_due, canceled, unpaid, paused.",
        "Sera alimenté par Stripe une fois la facturation branchée.",
      ]}
    />
  );
}
