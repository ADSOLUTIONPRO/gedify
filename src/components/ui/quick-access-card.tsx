import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tone = "blue" | "violet" | "emerald" | "amber" | "rose" | "sky" | "slate";

type Props = {
  title: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  tone?: Tone;
  badge?: string;
};

const TONE: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function QuickAccessCard({ title, description, href, icon: Icon, tone = "blue", badge }: Props) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-sm backdrop-blur transition hover:border-blue-200 hover:bg-white"
    >
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${TONE[tone]}`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-bold text-slate-900">{title}</p>
          {badge ? (
            <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="truncate text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      <ArrowRight
        className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
        strokeWidth={2}
        aria-hidden="true"
      />
    </Link>
  );
}

export function QuickAccessGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>
  );
}
