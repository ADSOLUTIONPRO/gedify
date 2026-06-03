import { Bell } from "lucide-react";
import { ReminderCard } from "@/components/reminders/reminder-card";
import type { ReminderBucketLabel, ReminderRecord } from "@/lib/actions/reminder-store";

type RemindersListProps = {
  reminders: ReminderRecord[];
  labelById: Record<string, ReminderBucketLabel>;
  emptyTitle?: string;
  emptyDescription?: string;
};

/** Liste de rappels (pages filtrées). Labels de bucket pré-calculés. */
export function RemindersList({ reminders, labelById, emptyTitle = "Aucun rappel", emptyDescription = "Rien dans cette vue." }: RemindersListProps) {
  if (reminders.length === 0) {
    return (
      <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
        <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(6,182,212,0.10)", color: "#06B6D4" }}>
          <Bell className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <p className="mt-3 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{emptyTitle}</p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>{emptyDescription}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {reminders.map((r) => (
        <ReminderCard key={r.id} reminder={r} bucket={labelById[r.id] ?? { label: "—", tone: "slate" }} />
      ))}
    </div>
  );
}
