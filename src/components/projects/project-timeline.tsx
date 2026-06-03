import { CircleDot, Clock3 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import type { ProjectTimelineEvent } from "@/lib/projects/project-types";

type ProjectTimelineProps = {
  events: ProjectTimelineEvent[];
};

export function ProjectTimeline({ events }: ProjectTimelineProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Clock3}
        title="Aucune activité enregistrée"
        description="La timeline est prête pour suivre les créations, ajouts de documents, retraits et changements de statut."
      />
    );
  }

  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100"
          >
            <CircleDot className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 rounded-2xl bg-slate-50/80 px-4 py-3">
            <p className="text-sm font-extrabold text-slate-900">{event.label}</p>
            {event.details ? (
              <p className="mt-1 text-sm leading-6 text-slate-500">{event.details}</p>
            ) : null}
            <p className="mt-1 text-xs font-medium text-slate-400">{formatDateTime(event.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
