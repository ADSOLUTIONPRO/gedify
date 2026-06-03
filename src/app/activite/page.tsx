import Link from "next/link";
import { Activity, CheckCircle2, FileText, Mail, Sparkles, Workflow } from "lucide-react";
import { CollapsibleDetails } from "@/components/ui/collapsible-details";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { InfoMetric } from "@/components/ui/info-metric";
import { PageShell } from "@/components/ui/page-shell";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { listGedLogs } from "@/lib/ged/ged-store";
import { listLogs as listMailLogs } from "@/lib/mail-connector/log-store";
import { getDocuments } from "@/lib/paperless";
import { safePaperlessCollection } from "@/lib/paperless-resources";
import { listProjectFolders } from "@/lib/projects/project-store";

export const dynamic = "force-dynamic";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function groupLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((startToday - startDate) / 86_400_000);

  if (diff === 0) return "Aujourd’hui";
  if (diff === 1) return "Hier";
  if (diff <= 7) return "Cette semaine";
  return "Plus ancien";
}

export default async function ActivitePage() {
  const [documentsData, tasks, gedLogs, mailLogs, projects] = await Promise.all([
    getDocuments({ page_size: 8, ordering: "-added" }).catch(() => null),
    safePaperlessCollection("/api/tasks/"),
    listGedLogs(80),
    listMailLogs({ limit: 80 }),
    listProjectFolders(),
  ]);

  const documentEvents: TimelineItem[] =
    documentsData?.results.map((document) => ({
      id: `doc-${document.id}`,
      title: "Document importé ou modifié",
      description: document.title || `Document #${document.id}`,
      href: `/documents/${document.id}`,
      time: document.added ? formatDateTime(document.added) : undefined,
      date: document.added ?? undefined,
      icon: FileText,
      tone: "blue",
    })) ?? [];

  const projectEvents: TimelineItem[] = projects.flatMap((project) =>
    project.timeline.slice(0, 3).map((event) => ({
      id: `project-${project.id}-${event.id}`,
      title: event.label,
      description: project.name,
      href: `/dossiers/${project.id}`,
      time: formatDateTime(event.at),
      date: event.at,
      icon: Sparkles,
      tone: "violet" as const,
    }))
  );

  const mailEvents: TimelineItem[] = mailLogs.slice(0, 12).map((log) => ({
    id: `mail-${log.id}`,
    title: log.status === "error" ? "Erreur email" : "Email synchronisé",
    description: log.attachmentName ?? log.subject ?? log.accountName,
    time: formatDateTime(log.createdAt),
    date: log.createdAt,
    icon: Mail,
    tone: log.status === "error" ? "red" : "green",
    details: (
      <CollapsibleDetails title="Voir détails techniques">
        <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
          {JSON.stringify(log, null, 2)}
        </pre>
      </CollapsibleDetails>
    ),
  }));

  const gedEvents: TimelineItem[] = gedLogs.slice(0, 12).map((log) => ({
    id: `ged-${log.id}`,
    title: log.message,
    description: log.source,
    time: formatDateTime(log.createdAt),
    date: log.createdAt,
    icon: Activity,
    tone: log.level === "error" ? "red" : log.level === "success" ? "green" : "slate",
  }));

  const taskEvents: TimelineItem[] = tasks.ok
    ? tasks.data.results.slice(0, 10).map((task, index) => ({
        id: `task-${String(task.id ?? index)}`,
        title: String(task.task_name ?? task.name ?? "Tâche Gedify"),
        description: String(task.status ?? task.state ?? "Statut inconnu"),
        time: formatDateTime(String(task.date_done ?? task.created ?? new Date().toISOString())),
        date: String(task.date_done ?? task.created ?? new Date().toISOString()),
        icon: Workflow,
        tone: String(task.status ?? task.state).toLowerCase().includes("fail") ? "red" : "slate",
        details: (
          <CollapsibleDetails title="Voir détails techniques">
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
              {JSON.stringify(task, null, 2)}
            </pre>
          </CollapsibleDetails>
        ),
      }))
    : [];

  const allEvents = [...gedEvents, ...mailEvents, ...projectEvents, ...documentEvents, ...taskEvents]
    .filter((event) => event.date)
    .sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime())
    .slice(0, 80);

  const groups = ["Aujourd’hui", "Hier", "Cette semaine", "Plus ancien"].map((label) => ({
    label,
    items: allEvents.filter((event) => groupLabel(String(event.date)) === label),
  }));

  return (
    <PageShell>
      <CompactPageHeader
        eyebrow="Supervision"
        title="Activité"
        description="Timeline humaine des documents, dossiers, emails, workflows et tâches."
        actions={<Link href="/journaux" className="text-sm font-bold text-blue-700 hover:underline">Journaux</Link>}
      />

      <section className="grid gap-2.5 sm:grid-cols-4">
        <InfoMetric label="Événements" value={allEvents.length} icon={Activity} tone="blue" />
        <InfoMetric label="Documents" value={documentEvents.length} icon={FileText} tone="green" />
        <InfoMetric label="Emails" value={mailEvents.length} icon={Mail} tone="violet" />
        <InfoMetric label="Tâches" value={taskEvents.length} icon={Workflow} tone="amber" />
      </section>

      {allEvents.length === 0 ? (
        <CompactEmptyState
          icon={CheckCircle2}
          title="Aucune activité récente"
          description="Les prochains imports, analyses et synchronisations apparaîtront ici."
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) =>
            group.items.length > 0 ? (
              <section key={group.label}>
                <h2 className="mb-2 text-sm font-extrabold text-slate-900">{group.label}</h2>
                <Timeline items={group.items} />
              </section>
            ) : null
          )}
        </div>
      )}
    </PageShell>
  );
}
