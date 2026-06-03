import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarDays, FileText, Repeat, Wallet, type LucideIcon } from "lucide-react";
import { RemindersList } from "@/components/reminders/reminders-list";
import type { ReminderGroups } from "@/lib/actions/reminder-store";

type CardDef = { label: string; value: number; color: string; icon: LucideIcon; href: string };

/** Vue d'ensemble Rappels — reçoit les groupes pré-calculés (purity). */
export function RemindersOverview({ groups }: { groups: ReminderGroups }) {
  const cards: CardDef[] = [
    { label: "Aujourd'hui", value: groups.today.length, color: "#06B6D4", icon: CalendarDays, href: "/rappels/a-venir" },
    { label: "Cette semaine", value: groups.week.length, color: "#0B5CFF", icon: CalendarClock, href: "/rappels/a-venir" },
    { label: "En retard", value: groups.overdue.length, color: "#EF4444", icon: AlertTriangle, href: "/rappels/en-retard" },
    { label: "Récurrents", value: groups.recurring.length, color: "#7C3AED", icon: Repeat, href: "/rappels/recurrents" },
    { label: "Liés aux finances", value: groups.finance.length, color: "#16A34A", icon: Wallet, href: "/finances" },
    { label: "Liés aux documents", value: groups.docs.length, color: "#0B5CFF", icon: FileText, href: "/documents" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} href={c.href} className="flex flex-col rounded-xl border bg-white p-3 transition hover:-translate-y-0.5" style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}>
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${c.color}14`, color: c.color }}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="mt-2 text-[17px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>{c.value}</span>
              <span className="text-[11px] font-medium leading-tight" style={{ color: "var(--text-muted)" }}>{c.label}</span>
            </Link>
          );
        })}
      </div>

      {groups.overdue.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>En retard</p>
            <Link href="/rappels/en-retard" className="text-[12px] font-semibold" style={{ color: "#EF4444" }}>Tout voir</Link>
          </div>
          <RemindersList reminders={groups.overdue.slice(0, 5)} labelById={groups.labelById} />
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>À venir</p>
          <Link href="/rappels/a-venir" className="text-[12px] font-semibold" style={{ color: "#06B6D4" }}>Tout voir</Link>
        </div>
        <RemindersList reminders={groups.upcoming.slice(0, 6)} labelById={groups.labelById} emptyTitle="Aucun rappel à venir" emptyDescription="Créez un rappel pour ne rien oublier." />
      </div>

      {groups.recurring.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Récurrents</p>
            <Link href="/rappels/recurrents" className="text-[12px] font-semibold" style={{ color: "#7C3AED" }}>Tout voir</Link>
          </div>
          <RemindersList reminders={groups.recurring.slice(0, 4)} labelById={groups.labelById} />
        </div>
      ) : null}
    </div>
  );
}
