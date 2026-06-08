"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, ChevronRight, Clock, PanelRightClose, PanelRightOpen } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   Panneau droit compact et repliable de l'agenda. Trois cartes :
   Mes événements (prochains, groupés par date), Sélection rapide (synthèse 7 j),
   En retard (tâches/échéances dépassées). Données réelles fournies par le serveur.
   ──────────────────────────────────────────────────────────────────────── */

export type RailEvent = { iso: string; title: string; tone: string };
export type RailOverdue = { iso: string; title: string; tone: string; href: string };

const TONE: Record<string, string> = { blue: "var(--gedify-info)", violet: "var(--gedify-purple)", emerald: "var(--gedify-green)", amber: "var(--gedify-orange)", rose: "#E11D48" };

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.getHours() === 0 && d.getMinutes() === 0) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function relativeDay(iso: string): string {
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export function AgendaRightPanel({ upcoming, overdue }: { upcoming: RailEvent[]; overdue: RailOverdue[] }) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="shrink-0">
        <button type="button" onClick={() => setOpen(true)} aria-label="Afficher le panneau" title="Afficher le panneau" className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
          <PanelRightOpen className="h-5 w-5" strokeWidth={1.85} />
        </button>
      </div>
    );
  }

  // Regroupe les prochains événements par date.
  const groups = new Map<string, RailEvent[]>();
  upcoming.forEach((e) => { const k = e.iso.slice(0, 10); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(e); });

  return (
    <aside className="w-[300px] shrink-0 space-y-3.5">
      <div className="flex items-center justify-end">
        <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold transition hover:opacity-80" style={{ color: "var(--text-muted)" }}>
          <PanelRightClose className="h-3.5 w-3.5" strokeWidth={1.85} /> Réduire le panneau
        </button>
      </div>

      {/* Mes événements */}
      <Card icon={CalendarDays} tone="violet" title="Mes événements">
        {groups.size === 0 ? (
          <p className="py-1 text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun événement à venir.</p>
        ) : (
          <div className="space-y-3">
            {[...groups.entries()].slice(0, 6).map(([date, items]) => (
              <div key={date}>
                <p className="mb-1 text-[11px] font-bold capitalize" style={{ color: "var(--text-hint)" }}>{relativeDay(date)}</p>
                <ul className="space-y-1">
                  {items.map((e, i) => {
                    const time = timeOf(e.iso);
                    return (
                      <li key={i} className="flex items-center gap-2 text-[12.5px]">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[e.tone] ?? "var(--gedify-purple)" }} />
                        <span className="w-12 shrink-0 font-semibold" style={{ color: "var(--text-muted)" }}>{time || "Jour"}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: "var(--text-main)" }}>{e.title}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        <Link href="/calendrier?view=liste" className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: "var(--accent)" }}>Voir tous les événements <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} /></Link>
      </Card>

      {/* Sélection rapide */}
      <Card icon={Clock} tone="blue" title="Sélection rapide">
        {upcoming.length === 0 ? (
          <p className="py-1 text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun événement dans les 7 prochains jours.</p>
        ) : (
          <p className="py-1 text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{upcoming.length} événement{upcoming.length > 1 ? "s" : ""} à venir cette semaine.</p>
        )}
        <Link href="/actions" className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: "var(--accent)" }}>Voir tous <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} /></Link>
      </Card>

      {/* En retard */}
      <Card icon={Bell} tone="rose" title="En retard">
        {overdue.length === 0 ? (
          <p className="py-1 text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun retard. Bravo.</p>
        ) : (
          <ul className="space-y-2">
            {overdue.slice(0, 5).map((o, i) => {
              const d = new Date(o.iso); d.setHours(0, 0, 0, 0);
              const t = new Date(); t.setHours(0, 0, 0, 0);
              const days = Math.max(0, Math.round((t.getTime() - d.getTime()) / 86_400_000));
              return (
                <li key={i}>
                  <Link href={o.href} className="block rounded-lg border px-2.5 py-1.5 transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border-soft)" }}>
                    <span className="block truncate text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>{o.title}</span>
                    <span className="mt-0.5 flex items-center justify-between text-[11px]">
                      <span style={{ color: "#E11D48" }}>En retard depuis {days} j</span>
                      <span style={{ color: "var(--text-hint)" }}>{new Date(o.iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/actions/en-retard" className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: "var(--accent)" }}>Voir toutes les tâches <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} /></Link>
      </Card>
    </aside>
  );
}

function Card({ icon: Icon, tone, title, children }: { icon: React.ElementType; tone: "violet" | "blue" | "rose"; title: string; children: React.ReactNode }) {
  const color = tone === "violet" ? "var(--gedify-purple)" : tone === "blue" ? "var(--gedify-info)" : "#E11D48";
  return (
    <section className="rounded-2xl border bg-white p-3.5" style={{ borderColor: "var(--border)" }}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color }}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </span>
        <h3 className="text-[13.5px] font-extrabold" style={{ color: "var(--text-main)" }}>{title}</h3>
      </div>
      {children}
    </section>
  );
}
