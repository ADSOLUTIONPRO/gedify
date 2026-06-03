import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Cog,
  FileText,
  Mail,
  Sparkles,
  Wallet,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import {
  bucketByTime,
  formatDateRelative,
  formatEventSource,
  formatEventStatus,
  formatHourMinute,
  sourceAccent,
  sourceTone,
  statusTone,
  timeBucketLabel,
  type ActivitySource,
  type TimeBucket,
} from "@/lib/activity/activity-formatters";
import type { ActivityEvent } from "@/lib/activity/activity-aggregator";

type ActivityTimelineProps = {
  events: ActivityEvent[];
  updatedAt: string;
};

const SOURCE_ICONS: Record<ActivitySource, LucideIcon> = {
  paperless: FileText,
  tasks: Cog,
  ai: Sparkles,
  email: Mail,
  budget: Wallet,
  workflow: Workflow,
  system: AlertTriangle,
};

const BUCKET_ORDER: TimeBucket[] = ["today", "yesterday", "this_week", "older"];

function groupByBucket(events: ActivityEvent[]): Record<TimeBucket, ActivityEvent[]> {
  const groups: Record<TimeBucket, ActivityEvent[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    older: [],
  };
  for (const event of events) {
    groups[bucketByTime(event.timestamp)].push(event);
  }
  return groups;
}

export function ActivityTimeline({ events, updatedAt }: ActivityTimelineProps) {
  const groups = groupByBucket(events);
  const hasAny = events.length > 0;

  return (
    <SectionCard
      title="Flux d'activité"
      description={`Actualisé à ${formatHourMinute(updatedAt)} · ${events.length} événement(s)`}
      bodyClassName="p-0"
    >
      {!hasAny ? (
        <div className="p-5">
          <EmptyState
            title="Aucune activité récente"
            description="Importez un document, lancez une analyse IA ou synchronisez votre boîte mail pour voir apparaître les événements ici."
          />
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {BUCKET_ORDER.map((bucket) =>
            groups[bucket].length === 0 ? null : (
              <BucketBlock
                key={bucket}
                label={timeBucketLabel(bucket)}
                events={groups[bucket]}
              />
            )
          )}
        </div>
      )}
    </SectionCard>
  );
}

function BucketBlock({ label, events }: { label: string; events: ActivityEvent[] }) {
  return (
    <section>
      <div
        className="flex items-center justify-between px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{
          color: "var(--text-muted)",
          background: "rgba(11,92,255,0.04)",
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{events.length} événement(s)</span>
      </div>
      <ul>
        {events.map((event, index) => (
          <TimelineRow
            key={event.id}
            event={event}
            isLast={index === events.length - 1}
          />
        ))}
      </ul>
    </section>
  );
}

function TimelineRow({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const Icon = SOURCE_ICONS[event.source] ?? FileText;
  const accent = sourceAccent(event.source);
  const tone = sourceTone(event.source);
  const sTone = statusTone(event.status);

  const body = (
    <div className="flex items-start gap-3 px-5 py-3 transition hover:bg-slate-50/60">
      {/* Vertical guide + icon */}
      <div className="relative flex shrink-0 flex-col items-center">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl ring-2 ring-white"
          style={{
            background: `${accent}1A`,
            color: accent,
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
        {!isLast ? (
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-9 h-[calc(100%-9px)] w-px -translate-x-1/2"
            style={{ background: "var(--border)" }}
          />
        ) : null}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className="truncate text-sm font-bold"
            style={{ color: "var(--text-main)" }}
            title={event.title}
          >
            {event.title}
          </p>
          <StatusPill tone={sTone} dot>
            {formatEventStatus(event.status)}
          </StatusPill>
          <SourcePill tone={tone}>{formatEventSource(event.source)}</SourcePill>
        </div>
        <p
          className="mt-0.5 line-clamp-2 text-xs"
          style={{ color: "var(--text-muted)" }}
          title={event.description}
        >
          {event.description}
        </p>
        <div
          className="mt-1.5 flex items-center gap-3 text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          <span>{formatDateRelative(event.timestamp)}</span>
          {event.technicalRef ? (
            <span className="font-mono opacity-60" title={event.technicalRef}>
              #{String(event.technicalRef).slice(-8)}
            </span>
          ) : null}
        </div>
      </div>

      {/* CTA */}
      {event.href ? (
        <span
          className="ml-auto shrink-0 inline-flex h-7 items-center gap-1 self-center text-xs font-bold"
          style={{ color: "var(--blue-600)" }}
        >
          Détail
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );

  return (
    <li>
      {event.href ? (
        <Link href={event.href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

function SourcePill({
  tone,
  children,
}: {
  tone: "blue" | "violet" | "emerald" | "amber" | "rose" | "slate" | "orange";
  children: React.ReactNode;
}) {
  const PALETTE: Record<typeof tone, { bg: string; color: string }> = {
    blue: { bg: "rgba(11,92,255,0.08)", color: "#0B5CFF" },
    violet: { bg: "rgba(124,58,237,0.10)", color: "#7C3AED" },
    emerald: { bg: "rgba(16,163,74,0.08)", color: "#16A34A" },
    amber: { bg: "rgba(245,158,11,0.10)", color: "#B45309" },
    rose: { bg: "rgba(239,68,68,0.08)", color: "#DC2626" },
    slate: { bg: "rgba(100,116,139,0.10)", color: "#475569" },
    orange: { bg: "rgba(249,115,22,0.10)", color: "#EA580C" },
  };
  const p = PALETTE[tone];
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: p.bg, color: p.color }}
    >
      {children}
    </span>
  );
}
