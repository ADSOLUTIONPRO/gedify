"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, X } from "lucide-react";

export type CleanupItem = { label: string; href: string };

export type CleanupGroup = {
  id: string;
  title: string;
  description: string;
  count: number;
  /** Lien « Voir » global vers la liste filtrée concernée. */
  href: string;
  /** Quelques éléments concernés (aperçu cliquable). */
  items?: CleanupItem[];
};

type CleanupSuggestionsProps = {
  groups: CleanupGroup[];
};

/**
 * Suggestions de nettoyage calculées à partir des données réelles. Toutes les
 * actions sont navigables ou réversibles (« Ignorer » local). Aucune
 * suppression automatique : la correction se fait toujours manuellement, avec
 * confirmation, depuis la page concernée.
 */
export function CleanupSuggestions({ groups }: CleanupSuggestionsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = groups.filter((g) => !dismissed.has(g.id) && g.count > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "rgba(16,163,74,0.05)" }}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#15803D" }} strokeWidth={1.75} aria-hidden="true" />
        <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          Aucune suppression automatique. Chaque correction se fait manuellement et avec confirmation depuis la page concernée.
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
          <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(16,163,74,0.10)", color: "#15803D" }}>
            <Sparkles className="h-6 w-6" strokeWidth={1.6} />
          </span>
          <p className="mt-3 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
            Tout est propre
          </p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
            Aucune suggestion de nettoyage pour le moment.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((group) => (
            <section key={group.id} className="flex flex-col rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
                    {group.title}
                    <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: "rgba(245,158,11,0.12)", color: "#B45309" }}>
                      {group.count}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                    {group.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissed((prev) => new Set(prev).add(group.id))}
                  aria-label="Ignorer cette suggestion"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              {group.items && group.items.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {group.items.slice(0, 4).map((item) => (
                    <li key={item.href + item.label}>
                      <Link href={item.href} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12.5px] transition hover:bg-slate-50">
                        <span className="truncate font-medium" style={{ color: "var(--text-main)" }}>
                          {item.label}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              <Link
                href={group.href}
                className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold transition hover:bg-slate-50"
                style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
              >
                Voir et corriger
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
