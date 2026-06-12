import { Bell } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { requireTenantMember } from "@/lib/auth/guards";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { SettingsSubPage } from "@/components/settings/settings-ui";

export const dynamic = "force-dynamic";

export default async function SettingsNotificationsPage() {
  await requireTenantMember();
  return (
    <SettingsSubPage title="Notifications" subtitle="Vos préférences d'alertes et de résumés (propres à votre compte).">
      <SectionCard icon={Bell} title="Préférences de notifications">
        <NotificationSettings />
      </SectionCard>
    </SettingsSubPage>
  );
}
