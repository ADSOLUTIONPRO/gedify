import { Banknote } from "lucide-react";
import { SaasPlaceholder } from "@/components/saas/saas-placeholder";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SaasPlaceholder
      label="Stripe"
      title="Stripe"
      icon={Banknote}
      description="Configuration Stripe : produits, prices, webhooks, mode test/live, état de connexion."
      bullets={[
        "Stripe pas encore activé.",
        "Prévu : clés API (test/live), webhooks, mapping plans ↔ prices.",
      ]}
    />
  );
}
