import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { AddReminderButton } from "@/components/reminders/reminder-form";
import { RemindersList } from "@/components/reminders/reminders-list";
import { bucketReminders, listReminders } from "@/lib/actions/reminder-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "En retard — Rappels" };

export default async function RappelsEnRetardPage() {
  const groups = bucketReminders(await listReminders());
  return (
    <SpaceLayout spaceId="rappels" actions={<AddReminderButton />}>
      <p className="mb-3 text-[13px]" style={{ color: "var(--danger)" }}>
        Rappels dont la date est passée. Reportez-les ou marquez-les terminés.
      </p>
      <RemindersList reminders={groups.overdue} labelById={groups.labelById} emptyTitle="Aucun retard 🎉" emptyDescription="Tous vos rappels sont à jour." />
    </SpaceLayout>
  );
}
