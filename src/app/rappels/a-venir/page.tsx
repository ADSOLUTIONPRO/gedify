import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { AddReminderButton } from "@/components/reminders/reminder-form";
import { RemindersList } from "@/components/reminders/reminders-list";
import { bucketReminders, listReminders } from "@/lib/actions/reminder-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "À venir — Rappels" };

export default async function RappelsAVenirPage() {
  const groups = bucketReminders(await listReminders());
  return (
    <SpaceLayout spaceId="rappels" actions={<AddReminderButton />}>
      <RemindersList reminders={groups.upcoming} labelById={groups.labelById} emptyTitle="Aucun rappel à venir" emptyDescription="Créez un rappel pour ne rien oublier." />
    </SpaceLayout>
  );
}
