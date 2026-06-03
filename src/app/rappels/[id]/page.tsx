import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpaceLayout } from "@/components/layout/space-layout";
import { ReminderDetailPanel } from "@/components/reminders/reminder-detail-panel";
import { getReminder } from "@/lib/actions/reminder-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rappel — Rappels" };

type Ctx = { params: Promise<{ id: string }> };

export default async function ReminderDetailPage({ params }: Ctx) {
  const { id } = await params;
  const reminder = await getReminder(id);
  if (!reminder) notFound();
  return (
    <SpaceLayout spaceId="rappels">
      <ReminderDetailPanel reminder={reminder} />
    </SpaceLayout>
  );
}
