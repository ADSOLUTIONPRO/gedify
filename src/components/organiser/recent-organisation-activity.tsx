import Link from "next/link";
import { Clock } from "lucide-react";

export type OrganisationActivityItem = {
  label: string;
  detail: string;
  when: string;
  href?: string;
};

type RecentOrganisationActivityProps = {
  items: OrganisationActivityItem[];
};

/**
 * Dernières modifications du classement (dossiers mis à jour, etc.).
 * État vide compact si aucune activité.
 */
export function RecentOrganisationActivity({ items }: RecentOrganisationActivityProps) {
  return (
    <section className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
        <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Dernières modifications
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
          Aucune modification récente du classement.
        </p>
      ) : (
        <ul className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
          {items.map((item, i) => {
            const content = (
              <span className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>
                    {item.label}
                  </span>
                  <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                    {item.detail}
                  </span>
                </span>
                <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {item.when}
                </span>
              </span>
            );
            return (
              <li key={`${item.label}-${i}`} style={{ borderColor: "var(--border)" }}>
                {item.href ? (
                  <Link href={item.href} className="block rounded-lg px-1 transition hover:bg-slate-50">
                    {content}
                  </Link>
                ) : (
                  <span className="block px-1">{content}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
