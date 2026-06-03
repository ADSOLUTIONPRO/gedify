import Link from "next/link";
import type { ReactNode } from "react";

type ActionCardProps = {
  title: string;
  description?: string;
  href: string;
  badge?: string;
  external?: boolean;
  icon?: ReactNode;
  tone?: "default" | "blue" | "emerald";
};

const toneClasses = {
  default: "border-slate-200 bg-white hover:border-blue-300",
  blue: "border-blue-200 bg-blue-50 hover:border-blue-400",
  emerald: "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
} as const;

export function ActionCard({
  title,
  description,
  href,
  badge,
  external,
  icon,
  tone = "default",
}: ActionCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        {icon ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
            {icon}
          </div>
        ) : null}
        {badge ? (
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-black text-slate-950">{title}</p>
      {description ? (
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-600">{description}</p>
      ) : null}
    </>
  );

  const className = `block rounded-xl border p-3 transition ${toneClasses[tone]}`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
