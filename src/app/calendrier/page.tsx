import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Folder,
  Mail,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar";
import { StatusPill } from "@/components/ui/status-pill";
import { listActions } from "@/lib/actions/action-store";
import { getAllDueItems } from "@/lib/budget/budget-calculations";
import { listEvents } from "@/lib/calendar/calendar-event-store";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AgendaEventsCard } from "@/components/calendar/agenda-events-card";
import { CalendarTimeViews } from "@/components/calendar/calendar-time-views";
import { GoogleSyncButton } from "@/components/calendar/google-sync-button";
import { formatMoney } from "@/lib/format-money";

export const dynamic = "force-dynamic";

type CalendarEvent = {
  date: string;
  label: string;
  tone: "blue" | "violet" | "emerald" | "amber" | "rose";
  href: string;
};

function MonthCalendar({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = today.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const TONE_PALETTE: Record<CalendarEvent["tone"], { bg: string; color: string }> = {
    blue: { bg: "rgba(11,92,255,0.10)", color: "#0B5CFF" },
    violet: { bg: "rgba(124,58,237,0.12)", color: "#7C3AED" },
    emerald: { bg: "rgba(16,163,74,0.12)", color: "#16A34A" },
    amber: { bg: "rgba(245,158,11,0.14)", color: "#B45309" },
    rose: { bg: "rgba(239,68,68,0.10)", color: "#DC2626" },
  };

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    const eventDate = new Date(event.date);
    if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
      const day = eventDate.getDate();
      if (!eventsByDay.has(day)) eventsByDay.set(day, []);
      eventsByDay.get(day)!.push(event);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>
          <p
            className="ml-2 text-base font-extrabold capitalize"
            style={{ color: "var(--text-main)" }}
          >
            {monthName}
          </p>
        </div>
      </div>

      <div
        className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          const dayEvents = d ? eventsByDay.get(d) ?? [] : [];
          const isToday = d === today.getDate();
          return (
            <div
              key={i}
              className="flex min-h-[88px] flex-col gap-1 rounded-xl p-2"
              style={
                d === null
                  ? { background: "rgba(11,92,255,0.02)" }
                  : isToday
                  ? {
                      background: "rgba(11,92,255,0.08)",
                      border: "1px solid var(--blue-600)",
                    }
                  : {
                      background: "white",
                      border: "1px solid var(--border)",
                    }
              }
            >
              {d ? (
                <>
                  <span
                    className={`text-[11px] font-bold ${isToday ? "" : ""}`}
                    style={{
                      color: isToday ? "var(--blue-600)" : "var(--text-main)",
                    }}
                  >
                    {d}
                  </span>
                  <div className="flex flex-col gap-1">
                    {dayEvents.slice(0, 3).map((event, idx) => {
                      const palette = TONE_PALETTE[event.tone];
                      return (
                        <Link
                          key={idx}
                          href={event.href}
                          className="truncate rounded-md px-1 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: palette.bg,
                            color: palette.color,
                          }}
                          title={event.label}
                        >
                          {event.label}
                        </Link>
                      );
                    })}
                    {dayEvents.length > 3 ? (
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: "var(--text-muted)" }}
                      >
                        +{dayEvents.length - 3} autres
                      </span>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TONE_COLOR: Record<CalendarEvent["tone"], string> = {
  blue: "var(--gedify-info)", violet: "var(--gedify-purple)", emerald: "var(--gedify-green)", amber: "var(--gedify-orange)", rose: "#E11D48",
};

/** Regroupe un événement par période relative (liste chronologique). */
function periodOf(dateStr: string, today: Date): "past" | "today" | "tomorrow" | "week" | "later" {
  const d = new Date(dateStr);
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = Math.round((d0 - t0) / 86_400_000);
  if (days < 0) return "past";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "week";
  return "later";
}

const PERIOD_LABEL: Record<string, string> = { past: "En retard", today: "Aujourd'hui", tomorrow: "Demain", week: "Cette semaine", later: "Plus tard" };

function EventList({ events, today }: { events: CalendarEvent[]; today: Date }) {
  const sorted = [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const groups = (["past", "today", "tomorrow", "week", "later"] as const)
    .map((k) => ({ key: k, label: PERIOD_LABEL[k], items: sorted.filter((e) => periodOf(e.date, today) === k) }))
    .filter((g) => g.items.length > 0);
  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>Aucun événement à afficher.</p>;
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: g.key === "past" ? "#E11D48" : "var(--text-hint)" }}>{g.label}</p>
          <ul className="space-y-1">
            {g.items.map((e, i) => (
              <li key={`${e.href}-${i}`}>
                <Link href={e.href} className="flex items-center gap-2.5 rounded-xl border px-3 py-2 transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border-soft)" }}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE_COLOR[e.tone] }} aria-hidden="true" />
                  <span className="w-20 shrink-0 text-[11.5px] font-semibold" style={{ color: "var(--text-muted)" }}>
                    {new Date(e.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{e.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default async function CalendrierPage({ searchParams }: { searchParams?: Promise<{ view?: string; d?: string }> }) {
  const sp = (await searchParams) ?? {};
  const view = sp.view ?? "month";
  const focusDate = sp.d;
  const [actions, dueItemsData, user] = await Promise.all([listActions(), getAllDueItems(), getCurrentUser()]);
  const calendarEvents = await listEvents(user ? String(user.id) : "local").catch(() => []);

  const today = new Date();
  const events: CalendarEvent[] = [];

  // Événements de l'agenda (socle CalendarEvent : RDV créés depuis la Fiche Doc, etc.).
  for (const ev of calendarEvents) {
    events.push({ date: ev.start, label: ev.title.slice(0, 32), tone: "violet", href: "/calendrier" });
  }

  for (const action of actions) {
    if (!action.dueDate) continue;
    events.push({
      date: action.dueDate,
      label: action.title.slice(0, 32),
      tone:
        action.status === "overdue"
          ? "rose"
          : action.priority === "urgent"
          ? "amber"
          : action.priority === "high"
          ? "violet"
          : "blue",
      href: `/actions/${action.id}`,
    });
  }
  for (const item of dueItemsData.all) {
    if (!item.dueDate) continue;
    events.push({
      date: item.dueDate,
      label: `${item.label.slice(0, 22)} · ${formatMoney(
        item.amountRemaining ?? item.amount,
        item.currency
      )}`,
      tone:
        item.paymentStatus === "overdue"
          ? "rose"
          : item.paymentStatus === "due_soon"
          ? "amber"
          : "emerald",
      href: `/budget/dettes`,
    });
  }

  const upcomingWindow = 7;
  const upcoming = events
    .filter((e) => {
      const date = new Date(e.date);
      const diff = (date.getTime() - today.getTime()) / 86_400_000;
      return diff >= 0 && diff <= upcomingWindow;
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const overdueEvents = events
    .filter((e) => new Date(e.date) < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .slice(0, 5);

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { label: "Calendrier & Rendez-vous" },
        ]}
        title="Calendrier & Rendez-vous"
        description="Consultez, confirmez ou gérez vos rendez-vous, échéances et rappels depuis vos documents."
        actions={<GoogleSyncButton />}
      />

      {/* Structure 3 colonnes façon Google Calendar : navigation, calendrier, rail. */}
      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Colonne gauche : navigation + mini-calendrier + vues + accès rapides */}
        <div className="shrink-0 lg:w-56">
          <CalendarSidebar currentView={view} />
        </div>

        {/* Zone centrale : calendrier */}
        <div className="min-w-0 flex-1">
          <SectionCard
            icon={CalendarRange}
            title={view === "liste" ? "Vue Liste" : view === "jour" ? "Vue Jour" : view === "semaine" ? "Vue Semaine" : view === "annee" ? "Vue Année" : "Vue du mois"}
            description={`${events.length} événement(s) au total`}
          >
            {view === "liste" ? (
              <EventList events={events} today={today} />
            ) : view === "jour" || view === "semaine" || view === "annee" ? (
              <CalendarTimeViews view={view} allDayItems={events} todayISO={today.toISOString()} initialDateISO={focusDate} />
            ) : (
              <MonthCalendar events={events} />
            )}
          </SectionCard>
        </div>

        {/* Rail droit (plus étroit, ~320px) */}
        <aside className="shrink-0 space-y-4 lg:w-[320px]">
          <RightRailCard title="Mes événements" icon={CalendarDays} iconTone="violet" bodyClassName="space-y-2">
            <AgendaEventsCard />
          </RightRailCard>

          <RightRailCard
            title="Sélection rapide"
            icon={Clock}
            iconTone="blue"
            ctaHref="/actions"
            ctaLabel="Voir tous"
            bodyClassName="space-y-2"
          >
            {upcoming.length === 0 ? (
              <p className="py-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Aucun événement dans les 7 prochains jours.
              </p>
            ) : (
              upcoming.slice(0, 8).map((event, idx) => (
                <Link
                  key={`${event.date}-${idx}`}
                  href={event.href}
                  className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-xs transition hover:bg-slate-50"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        event.tone === "rose"
                          ? "#DC2626"
                          : event.tone === "amber"
                          ? "#D97706"
                          : event.tone === "emerald"
                          ? "#16A34A"
                          : event.tone === "violet"
                          ? "#7C3AED"
                          : "#0B5CFF",
                    }}
                  />
                  <span className="truncate font-semibold" style={{ color: "var(--text-main)" }}>
                    {event.label}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {new Date(event.date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </Link>
              ))
            )}
          </RightRailCard>

          <RightRailCard
            title="En retard"
            icon={Bell}
            iconTone="rose"
            ctaHref="/actions/en-retard"
            ctaLabel="Voir tous"
            bodyClassName="space-y-2"
          >
            {overdueEvents.length === 0 ? (
              <p className="py-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Aucun retard. Bravo.
              </p>
            ) : (
              overdueEvents.map((event, idx) => (
                <Link
                  key={`overdue-${idx}`}
                  href={event.href}
                  className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-xs transition hover:bg-slate-50"
                >
                  <span className="truncate font-semibold" style={{ color: "var(--text-main)" }}>
                    {event.label}
                  </span>
                  <StatusPill tone="rose" dot>
                    {new Date(event.date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </StatusPill>
                </Link>
              ))
            )}
          </RightRailCard>
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <SectionCard icon={CalendarDays} title="Aujourd'hui" description="Vue rapide">
          <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
            {today.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {upcoming.filter((e) => new Date(e.date).toDateString() === today.toDateString()).length}{" "}
            événement(s) prévus.
          </p>
        </SectionCard>
        <SectionCard icon={Folder} title="Documents liés">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Les actions et échéances s&apos;appuient sur vos documents Gedify analysés.
          </p>
        </SectionCard>
        <SectionCard icon={Users} title="Correspondants">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Tag les correspondants pour filtrer les événements.
          </p>
        </SectionCard>
        <SectionCard icon={Mail} title="Agendas connectés">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Synchronisation Google / iCal — bientôt disponible.
          </p>
        </SectionCard>
      </div>

      <SectionCard icon={Coins} title="Aperçu financier du mois" description="Échéances avec impact budget">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Total dû ce mois" value={formatMoney(
            dueItemsData.bucketed.this_month.reduce(
              (sum, item) => sum + (item.amountRemaining ?? item.amount),
              0
            )
          )} tone="amber" />
          <Metric label="En retard" value={formatMoney(
            dueItemsData.bucketed.overdue.reduce(
              (sum, item) => sum + (item.amountRemaining ?? item.amount),
              0
            )
          )} tone="rose" />
          <Metric label="Plus tard" value={formatMoney(
            dueItemsData.bucketed.later.reduce(
              (sum, item) => sum + (item.amountRemaining ?? item.amount),
              0
            )
          )} tone="blue" />
        </div>
      </SectionCard>
    </PageShell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "amber" | "rose";
}) {
  const PALETTE: Record<typeof tone, { bg: string; color: string }> = {
    blue: { bg: "rgba(11,92,255,0.06)", color: "var(--blue-600)" },
    amber: { bg: "rgba(245,158,11,0.10)", color: "#B45309" },
    rose: { bg: "rgba(239,68,68,0.08)", color: "#DC2626" },
  };
  const p = PALETTE[tone];
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: p.bg, border: `1px solid ${p.color}33` }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-wide"
        style={{ color: p.color }}
      >
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold" style={{ color: "var(--text-main)" }}>
        {value}
      </p>
    </div>
  );
}
