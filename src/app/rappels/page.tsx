import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { SpaceLayout } from "@/components/layout/space-layout";
import { AddReminderButton } from "@/components/reminders/reminder-form";
import { RemindersOverview } from "@/components/reminders/reminders-overview";
import { bucketReminders, listReminders } from "@/lib/actions/reminder-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mes tâches — Gedify" };

export default async function RappelsPage() {
  const reminders = await listReminders();
  const groups = bucketReminders(reminders);
  return (
    <SpaceLayout
      spaceId="rappels"
      actions={
        <>
          <AddReminderButton />
          <Link
            href="/calendrier"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <CalendarRange className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Voir calendrier
          </Link>
        </>
      }
    >
      <RemindersOverview groups={groups} />
    </SpaceLayout>
  );
}
