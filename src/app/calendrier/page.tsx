import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar";
import { AgendaShell } from "@/components/calendar/agenda-shell";
import { AgendaCalendar, type AgendaView, type AllDayItem } from "@/components/calendar/agenda-calendar";
import { AgendaRightPanel, type RailEvent, type RailOverdue } from "@/components/calendar/agenda-right-panel";
import { GoogleSyncButton } from "@/components/calendar/google-sync-button";
import { CreateCalendarItemButton } from "@/components/calendar/create-calendar-item-button";
import { listActions } from "@/lib/actions/action-store";
import { getAllDueItems } from "@/lib/budget/budget-calculations";
import { listEvents } from "@/lib/calendar/calendar-event-store";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

const VIEW_MAP: Record<string, AgendaView> = {
  jour: "jour", semaine: "semaine", mois: "mois", annee: "annee", liste: "liste",
  day: "jour", week: "semaine", month: "mois", year: "annee", list: "liste",
};

export default async function CalendrierPage({ searchParams }: { searchParams?: Promise<{ view?: string; d?: string }> }) {
  const sp = (await searchParams) ?? {};
  const initialView = VIEW_MAP[sp.view ?? "mois"] ?? "mois";
  const focusDate = sp.d;

  const [actions, dueItemsData, user] = await Promise.all([listActions(), getAllDueItems(), getCurrentUser()]);
  const calendarEvents = await listEvents(user ? String(user.id) : "local").catch(() => []);

  const today = new Date();

  // « Toute la journée » pour la grille : tâches + échéances UNIQUEMENT.
  // Les rendez-vous du socle sont récupérés côté client par AgendaCalendar
  // (évite tout doublon dans la grille).
  const allDayItems: AllDayItem[] = [];
  for (const action of actions) {
    if (!action.dueDate) continue;
    allDayItems.push({
      date: action.dueDate,
      label: action.title.slice(0, 44),
      tone: action.status === "overdue" ? "rose" : action.priority === "urgent" ? "amber" : action.priority === "high" ? "violet" : "blue",
      href: `/actions/${action.id}`,
    });
  }
  for (const item of dueItemsData.all) {
    if (!item.dueDate) continue;
    allDayItems.push({
      date: item.dueDate,
      label: item.label.slice(0, 44),
      tone: item.paymentStatus === "overdue" ? "rose" : "amber",
      href: "/budget/dettes",
    });
  }

  // Données du panneau droit (rendez-vous du socle + tâches + échéances).
  const railAll: { iso: string; title: string; tone: string; href: string }[] = [
    ...calendarEvents.map((ev) => ({ iso: ev.start, title: ev.title, tone: "violet", href: "/calendrier" })),
    ...allDayItems.map((a) => ({ iso: a.date, title: a.label, tone: a.tone, href: a.href })),
  ];
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const upcoming: RailEvent[] = railAll
    .filter((e) => { const diff = (new Date(e.iso).getTime() - t0) / 86_400_000; return diff >= 0 && diff <= 7; })
    .sort((a, b) => (a.iso < b.iso ? -1 : 1))
    .map((e) => ({ iso: e.iso, title: e.title, tone: e.tone }));
  const overdue: RailOverdue[] = railAll
    .filter((e) => new Date(e.iso).getTime() < t0)
    .sort((a, b) => (a.iso > b.iso ? -1 : 1))
    .slice(0, 6)
    .map((e) => ({ iso: e.iso, title: e.title, tone: e.tone, href: e.href }));

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { label: "Agenda & tâches" },
          { label: "Calendrier" },
        ]}
        title="Calendrier & Rendez-vous"
        description="Consultez, confirmez ou gérez vos rendez-vous, échéances et rappels depuis vos documents."
        actions={
          <div className="flex items-center gap-2">
            <GoogleSyncButton />
            <CreateCalendarItemButton className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[13.5px] font-bold text-white shadow-sm transition hover:opacity-90" />
          </div>
        }
      />

      {/* Structure 3 colonnes façon Google Calendar (drawers sur mobile/tablette). */}
      <AgendaShell sidebar={<CalendarSidebar />} rightPanel={<AgendaRightPanel upcoming={upcoming} overdue={overdue} />}>
        <AgendaCalendar initialView={initialView} initialDateISO={focusDate} todayISO={today.toISOString()} allDayItems={allDayItems} />
      </AgendaShell>
    </PageShell>
  );
}
