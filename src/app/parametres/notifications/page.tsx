import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationSettings } from "@/components/settings/notification-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications — Paramètres" };

export default function NotificationsSettingsPage() {
  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/parametres", label: "Paramètres" }}
        eyebrow="Paramètres"
        title="Notifications"
        description="Centre de préférences : choisissez, par espace et par type d'événement, ce qui vous notifie dans GEDify et/ou par email."
      />
      <NotificationSettings />
    </main>
  );
}
