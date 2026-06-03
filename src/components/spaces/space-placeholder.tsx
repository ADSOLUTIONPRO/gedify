import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { getSpaceById } from "@/config/spaces";

type RelatedLink = {
  label: string;
  href: string;
  description: string;
};

type SpacePlaceholderProps = {
  spaceId: string;
  /** Liens vers les pages existantes couvertes par cet espace. */
  related: RelatedLink[];
};

/**
 * Contenu de transition pour un espace dont la page dédiée n'est pas encore
 * construite. Renvoie vers les routes existantes équivalentes (aucun 404).
 */
export function SpacePlaceholder({ spaceId, related }: SpacePlaceholderProps) {
  const space = getSpaceById(spaceId);
  const color = space?.color ?? "var(--blue-600)";

  return (
    <div className="space-y-5">
      <div
        className="flex items-start gap-3 rounded-2xl border bg-white p-4"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${color}14`, color }}
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Cet espace est en cours de construction dans la nouvelle architecture. En attendant,
          retrouvez ses fonctionnalités via les pages ci-dessous.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {related.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex flex-col rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5"
            style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
          >
            <span className="flex items-center justify-between">
              <span className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
                {link.label}
              </span>
              <ArrowRight
                className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5"
                style={{ color }}
                strokeWidth={2}
                aria-hidden="true"
              />
            </span>
            <span className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
              {link.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
