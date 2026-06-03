import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

type OrganiserCardProps = {
  title: string;
  count: number;
  description: string;
  color: string;
  icon: LucideIcon;
  href: string;
};

/**
 * Carte principale de la vue d'ensemble Organiser : icône colorée, nombre
 * d'éléments, courte description et lien discret « Ouvrir ».
 */
export function OrganiserCard({ title, count, description, color, icon: Icon, href }: OrganiserCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5"
      style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: `${color}14`, color }}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
          {count}
        </span>
      </div>
      <span className="mt-3 text-[15px] font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
        {title}
      </span>
      <span className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
        {description}
      </span>
      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color }}>
        Ouvrir
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" />
      </span>
    </Link>
  );
}
