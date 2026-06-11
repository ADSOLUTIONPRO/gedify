import { Users } from "lucide-react";
import { SaasPlaceholder } from "@/components/saas/saas-placeholder";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SaasPlaceholder
      label="Membres clients"
      title="Membres clients"
      icon={Users}
      description="Vue globale des utilisateurs par tenant et leurs rôles (owner/admin/member/viewer)."
      bullets={[
        "Les membres d'un tenant sont visibles sur sa fiche (Clients / Espaces → Détails).",
        "Vue globale consolidée + gestion des rôles (à venir).",
      ]}
    />
  );
}
