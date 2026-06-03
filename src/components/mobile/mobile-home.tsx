"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Database, FileText, HardDrive, Mail, Wallet } from "lucide-react";
import { Sparkline } from "@/components/dashboard/sparkline";
import type { DashboardData } from "@/lib/spaces/dashboard-data";

function euros(n: number): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return `${n} €`;
  }
}

const PERIODS = ["3M", "6M", "9M", "12M"] as const;

type SummaryCard = {
  label: string;
  value: string;
  sub: string;
  href: string;
  icon: typeof FileText;
  tint: string;
  soft: string;
};

/**
 * Accueil « app mobile » (< md) : vue d'ensemble (graphe + période), 3 cartes
 * synthèse (Documents / Mails / Finances), stockage et activité récente.
 * Réutilise `getDashboardData()` (mêmes chiffres que le bureau).
 */
export function MobileHome({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("12M");

  const cards: SummaryCard[] = [
    { label: "Documents", value: String(data.documents.total), sub: "indexés", href: "/documents", icon: FileText, tint: "#B0894F", soft: "#FBF3E6" },
    { label: "Mails", value: String(data.messagerie.accounts), sub: data.messagerie.accounts > 1 ? "comptes connectés" : "compte connecté", href: "/messagerie", icon: Mail, tint: "#F75C8D", soft: "#FDECF2" },
    { label: "Finances", value: euros(data.finances.toCollect), sub: "à encaisser", href: "/finances", icon: Wallet, tint: "#2563EB", soft: "#ECF3FF" },
  ];

  const pct = data.administration.storageUsedPct;

  return (
    <div className="space-y-4 px-4 py-4 md:hidden">
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
        Bonjour, voici un aperçu de votre activité.
      </p>

      {/* Vue d'ensemble */}
      <section className="rounded-3xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Vue d&apos;ensemble</h2>
          <span className="text-[12px] font-semibold" style={{ color: "var(--text-hint)" }}>12 derniers mois</span>
        </div>
        <div className="py-1"><Sparkline color="var(--accent)" className="h-24" /></div>
        <div className="mt-2 flex gap-1.5">
          {PERIODS.map((p) => {
            const active = p === period;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className="flex-1 rounded-full py-1.5 text-[12px] font-bold transition"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-hint)",
                  border: `1px solid ${active ? "transparent" : "var(--border)"}`,
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3 cartes synthèse */}
      <section className="space-y-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="flex items-center gap-3 rounded-3xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: c.soft }}>
                <Icon className="h-6 w-6" style={{ color: c.tint }} strokeWidth={1.85} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-muted)" }}>{c.label}</p>
                <p className="truncate text-[19px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>{c.value}</p>
                <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>{c.sub}</p>
              </div>
              <Link
                href={c.href}
                className="inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-[12.5px] font-bold"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                Voir <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            </div>
          );
        })}
      </section>

      {/* Stockage */}
      <section className="rounded-3xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "#F4F6F8" }}>
            <HardDrive className="h-6 w-6" style={{ color: "#475569" }} strokeWidth={1.85} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-extrabold" style={{ color: "var(--text-main)" }}>Espace de stockage</p>
            <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>Utilisé sur l&apos;ensemble des dossiers</p>
          </div>
          <span className="text-[18px] font-extrabold" style={{ color: "var(--accent)" }}>{pct !== null ? `${pct} %` : "—"}</span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--accent-soft)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%`, background: "var(--accent)" }} />
        </div>
        <Link href="/statut" className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: "var(--accent)" }}>
          <Database className="h-3.5 w-3.5" strokeWidth={2} /> Détails par dossier
        </Link>
      </section>

      {/* Activité récente */}
      <section className="rounded-3xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Activité récente</h2>
          <Link href="/documents" className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>Voir tout</Link>
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="py-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucune activité récente.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {data.recentActivity.slice(0, 4).map((item, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)" }}>
                  <FileText className="h-4 w-4" style={{ color: "var(--accent)" }} strokeWidth={1.85} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{item.title}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-hint)" }}>{item.when}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
