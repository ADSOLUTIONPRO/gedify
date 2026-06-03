import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { AddReminderButton } from "@/components/reminders/reminder-form";
import { RemindersList } from "@/components/reminders/reminders-list";
import { bucketReminders, listReminders } from "@/lib/actions/reminder-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Récurrents — Rappels" };

export default async function RappelsRecurrentsPage() {
  const groups = bucketReminders(await listReminders());
  return (
    <SpaceLayout spaceId="rappels" actions={<AddReminderButton />}>
      <RemindersList reminders={groups.recurring} labelById={groups.labelById} emptyTitle="Aucun rappel récurrent" emptyDescription="Les rappels quotidiens, hebdomadaires ou mensuels apparaîtront ici." />
    </SpaceLayout>
  );
}
