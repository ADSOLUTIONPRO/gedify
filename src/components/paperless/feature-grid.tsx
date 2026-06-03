import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export type FeatureLink = {
  title: string;
  description: string;
  href: string;
  icon?: LucideIcon;
  badge?: string;
  tone?: "blue" | "violet" | "emerald" | "amber" | "rose" | "sky";
};

const TONES = {
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
} as const;

export function FeatureGrid({ links }: { links: FeatureLink[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {links.map((link, index) => {
        const Icon = link.icon;
        const toneKeys = Object.keys(TONES) as Array<keyof typeof TONES>;
        const toneKey = link.tone ?? toneKeys[index % toneKeys.length];
        return (
          <Link
            key={link.href}
            href={link.href}
            className="group flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_8px_28px_-12px_rgba(15,23,42,0.10)] backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_36px_-12px_rgba(37,99,235,0.18)]"
          >
            <div className="flex items-start justify-between gap-3">
              {Icon ? (
                <span
                  aria-hidden="true"
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ${TONES[toneKey]}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
              ) : null}
              {link.badge ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {link.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-base font-extrabold text-slate-900">{link.title}</p>
            <p className="mt-1 flex-1 text-sm leading-6 text-slate-600">{link.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
              Ouvrir
              <ArrowRight
                className="h-3 w-3 transition group-hover:translate-x-0.5"
                strokeWidth={2}
                aria-hidden="true"
              />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
