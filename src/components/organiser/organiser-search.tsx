"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export type ReferentialEntry = {
  label: string;
  kind: string;
  href: string;
  color?: string;
};

type OrganiserSearchProps = {
  entries: ReferentialEntry[];
};

/**
 * Recherche globale dans les référentiels (types, tags, correspondants,
 * dossiers). Filtre côté client et propose des liens directs.
 */
export function OrganiserSearch({ entries }: OrganiserSearchProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return entries.filter((e) => e.label.toLowerCase().includes(q)).slice(0, 12);
  }, [entries, query]);

  return (
    <div className="relative">
      <div className="relative flex h-11 items-center">
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher dans les référentiels..."
          className="h-full w-full rounded-xl border bg-white pl-10 pr-4 text-sm font-medium outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        />
      </div>

      {query.trim() ? (
        <div
          className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border bg-white p-1 shadow-lg"
          style={{ borderColor: "var(--border)" }}
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Aucun référentiel ne correspond à « {query} ».
            </p>
          ) : (
            results.map((r) => (
              <Link
                key={`${r.kind}-${r.href}-${r.label}`}
                href={r.href}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color ?? "var(--blue-600)" }} />
                  <span className="truncate font-semibold" style={{ color: "var(--text-main)" }}>
                    {r.label}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  {r.kind}
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
