import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { RemindersList } from "@/components/reminders/reminders-list";
import { bucketReminders, listReminders } from "@/lib/actions/reminder-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Historique — Rappels" };

export default async function RappelsHistoriquePage() {
  const all = await listReminders();
  const groups = bucketReminders(all);
  const history = all.filter((r) => r.status === "done" || r.status === "cancelled");
  return (
    <SpaceLayout spaceId="rappels">
      <RemindersList reminders={history} labelById={groups.labelById} emptyTitle="Aucun historique" emptyDescription="Les rappels terminés ou annulés apparaîtront ici." />
    </SpaceLayout>
  );
}
