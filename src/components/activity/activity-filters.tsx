import Link from "next/link";
import { Download, Filter, RefreshCw, Search, Sparkles } from "lucide-react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  formatEventSource,
  type ActivitySource,
} from "@/lib/activity/activity-formatters";

type ActivityFiltersProps = {
  current: {
    source: ActivitySource | "all";
    period: "1d" | "7d" | "30d" | "all";
    important: boolean;
    query: string;
  };
  counts: Partial<Record<ActivitySource | "all", number>>;
  buildHref: (changes: Partial<{
    source: ActivitySource | "all";
    period: "1d" | "7d" | "30d" | "all";
    important: boolean;
    query: string;
  }>) => string;
};

const SOURCE_TABS: Array<ActivitySource | "all"> = [
  "all",
  "paperless",
  "tasks",
  "email",
  "ai",
  "budget",
  "workflow",
  "system",
];

const PERIOD_LABEL: Record<"1d" | "7d" | "30d" | "all", string> = {
  "1d": "24 h",
  "7d": "7 j",
  "30d": "30 j",
  all: "Tout",
};

export function ActivityFilters({ current, counts, buildHref }: ActivityFiltersProps) {
  const sourceTabs = SOURCE_TABS.map((source) => ({
    href: buildHref({ source }),
    label: source === "all" ? "Tous" : formatEventSource(source as ActivitySource),
    count: counts[source] ?? 0,
  }));
  const activeSourceHref = buildHref({ source: current.source });

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl bg-white p-3"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 8px -2px rgba(8,18,37,0.05)",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="overflow-x-auto">
          <SegmentedTabs tabs={sourceTabs} activeHref={activeSourceHref} size="sm" />
        </div>

        {/* Search */}
        <form action="/activite" method="get" className="ml-auto flex h-9 items-center gap-2">
          <input type="hidden" name="source" value={current.source} />
          <input type="hidden" name="period" value={current.period} />
          {current.important ? <input type="hidden" name="important" value="1" /> : null}
          <label className="relative inline-flex items-center">
            <Search
              className="pointer-events-none absolute left-3 h-3.5 w-3.5"
              style={{ color: "var(--text-muted)" }}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              defaultValue={current.query}
              placeholder="Rechercher un événement…"
              className="h-9 w-60 rounded-lg border bg-white pl-8 pr-3 text-xs font-medium outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            />
          </label>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Period */}
        <div
          className="inline-flex items-center gap-1 rounded-lg p-1"
          style={{ background: "rgba(11,92,255,0.04)", border: "1px solid var(--border)" }}
        >
          {(["1d", "7d", "30d", "all"] as const).map((p) => {
            const active = current.period === p;
            return (
              <Link
                key={p}
                href={buildHref({ period: p })}
                className="inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-bold transition"
                style={
                  active
                    ? { background: "var(--navy-900)", color: "white" }
                    : { color: "var(--text-muted)" }
                }
              >
                {PERIOD_LABEL[p]}
              </Link>
            );
          })}
        </div>

        {/* Important toggle */}
        <Link
          href={buildHref({ important: !current.important })}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold transition hover:bg-slate-50"
          style={{
            borderColor: current.important ? "rgba(11,92,255,0.4)" : "var(--border)",
            background: current.important ? "rgba(11,92,255,0.08)" : "white",
            color: current.important ? "var(--blue-600)" : "var(--text-main)",
          }}
        >
          <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          {current.important ? "Importants seulement" : "Seulement les importants"}
        </Link>

        <Link
          href="/activite"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[11px] font-bold transition hover:bg-slate-50"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          <RefreshCw className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Actualiser
        </Link>

        <button
          type="button"
          disabled
          title="Export à venir"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[11px] font-bold opacity-60"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          <Download className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Exporter
        </button>

        <span
          className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-muted)",
            background: "white",
          }}
        >
          <Filter className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          {current.source === "all" ? "Toutes sources" : formatEventSource(current.source as ActivitySource)}
        </span>
      </div>
    </div>
  );
}
