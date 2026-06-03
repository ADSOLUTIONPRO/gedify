import type { LucideIcon } from "lucide-react";
import { Lightbulb } from "lucide-react";
import type { ReactNode } from "react";

type HelpCardProps = {
  title: string;
  description?: ReactNode;
  examples?: string[];
  icon?: LucideIcon;
  tone?: "blue" | "emerald" | "violet" | "amber";
  className?: string;
  /** Compact banner layout: smaller height, examples inline on a single row when possible. */
  compact?: boolean;
};

const TONES = {
  blue: {
    border: "border-blue-200/60",
    bg: "from-blue-50/80 via-white to-indigo-50/40",
    pill: "bg-white/80 text-blue-600 ring-blue-100",
    title: "text-blue-950",
    body: "text-blue-900/85",
    chip: "border-blue-200 bg-white/80 text-blue-700",
  },
  emerald: {
    border: "border-emerald-200/60",
    bg: "from-emerald-50/80 via-white to-teal-50/40",
    pill: "bg-white/80 text-emerald-600 ring-emerald-100",
    title: "text-emerald-950",
    body: "text-emerald-900/85",
    chip: "border-emerald-200 bg-white/80 text-emerald-700",
  },
  violet: {
    border: "border-violet-200/60",
    bg: "from-violet-50/80 via-white to-purple-50/40",
    pill: "bg-white/80 text-violet-600 ring-violet-100",
    title: "text-violet-950",
    body: "text-violet-900/85",
    chip: "border-violet-200 bg-white/80 text-violet-700",
  },
  amber: {
    border: "border-amber-200/60",
    bg: "from-amber-50/80 via-white to-orange-50/40",
    pill: "bg-white/80 text-amber-600 ring-amber-100",
    title: "text-amber-950",
    body: "text-amber-900/85",
    chip: "border-amber-200 bg-white/80 text-amber-800",
  },
} as const;

export function HelpCard({
  title,
  description,
  examples,
  icon: Icon = Lightbulb,
  tone = "blue",
  className = "",
  compact,
}: HelpCardProps) {
  const t = TONES[tone];

  if (compact) {
    return (
      <section
        className={`flex flex-wrap items-center gap-3 rounded-2xl border ${t.border} bg-gradient-to-r ${t.bg} px-4 py-2.5 shadow-sm backdrop-blur ${className}`}
      >
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-inset ${t.pill}`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold leading-tight ${t.title}`}>{title}</p>
          {description ? (
            <div className={`mt-0.5 text-xs leading-snug ${t.body}`}>{description}</div>
          ) : null}
        </div>
        {examples && examples.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {examples.slice(0, 4).map((example) => (
              <span
                key={example}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${t.chip}`}
              >
                {example}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${t.border} bg-gradient-to-br ${t.bg} p-4 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.08)] backdrop-blur ${className}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-inset ${t.pill}`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-extrabold ${t.title}`}>{title}</p>
          {description ? (
            <div className={`mt-1 text-xs leading-5 ${t.body}`}>{description}</div>
          ) : null}
        </div>
      </div>
      {examples && examples.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {examples.map((example) => (
            <span
              key={example}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${t.chip}`}
            >
              {example}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
