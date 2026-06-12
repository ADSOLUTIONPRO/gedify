import { Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { requireTenantMember } from "@/lib/auth/guards";
import { NotificationSettings } from "@/components/settings/notification-settings";

export const dynamic = "force-dynamic";

const breadcrumb = [{ href: "/dashboard", label: "Accueil" }, { href: "/settings", label: "Paramètres" }, { label: "Notifications" }];

export default async function SettingsNotificationsPage() {
  await requireTenantMember();
  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Notifications" description="Vos préférences d'alertes et de résumés (propres à votre compte)." />
      <SectionCard icon={Bell} title="Préférences de notifications">
        <NotificationSettings />
      </SectionCard>
    </PageShell>
  );
}
