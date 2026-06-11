import { Send } from "lucide-react";
import { SaasPlaceholder } from "@/components/saas/saas-placeholder";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SaasPlaceholder
      label="Invitations clients"
      title="Invitations clients"
      icon={Send}
      description="Invitations envoyées aux owners/admins clients."
      bullets={["Statuts prévus : pending, accepted, expired.", "Envoi d'e-mail système (à venir)."]}
    />
  );
}
