"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ChevronRight, Receipt, TrendingUp, Wallet } from "lucide-react";
import { Sparkline } from "@/components/dashboard/sparkline";
import type { FinancialItemStatus } from "@/lib/budget/financial-item-types";

function euros(n: number): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return `${n} €`;
  }
}

const PERIODS = ["3M", "6M", "9M", "12M"] as const;

export type MobileInvoice = {
  id: string;
  label: string;
  correspondent: string | null;
  dateLabel: string;
  amount: number;
  currency: string;
  statusKey: FinancialItemStatus;
};

type Props = {
  toCollect: number;
  toCollectCount: number;
  expenses: number;
  expensesCount: number;
  result: number;
  forecast: number;
  invoices: MobileInvoice[];
};

function invoiceStatus(s: FinancialItemStatus): { label: string; bg: string; color: string } {
  if (s === "paid") return { label: "Payée", bg: "#EAF8EF", color: "#15803D" };
  if (s === "overdue") return { label: "En retard", bg: "#FDECEC", color: "#EF4444" };
  if (s === "partially_paid") return { label: "Partiel", bg: "#FFF4E5", color: "#B45309" };
  return { label: "À encaisser", bg: "var(--accent-soft)", color: "var(--accent)" };
}

/** Espace Finances en version « app mobile » (< md). */
export function MobileFinances({ toCollect, toCollectCount, expenses, expensesCount, result, forecast, invoices }: Props) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("12M");

  const cards: { label: string; value: string; sub: string; icon: typeof Wallet; tint: string; soft: string }[] = [
    { label: "À encaisser", value: euros(toCollect), sub: `${toCollectCount} facture${toCollectCount > 1 ? "s" : ""}`, icon: ArrowDownLeft, tint: "#F75C8D", soft: "#FDECF2" },
    { label: "Dépenses", value: euros(expenses), sub: `${expensesCount} dépense${expensesCount > 1 ? "s" : ""}`, icon: Receipt, tint: "#F59E0B", soft: "#FFF4E5" },
    { label: "Résultat", value: euros(result), sub: result >= 0 ? "positif" : "négatif", icon: Wallet, tint: "#2563EB", soft: "#ECF3FF" },
    { label: "Prévisionnel", value: euros(forecast), sub: "à venir", icon: TrendingUp, tint: "#15803D", soft: "#EAF8EF" },
  ];

  return (
    <div className="space-y-4 px-4 py-4 md:hidden">
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
              <button key={p} type="button" onClick={() => setPeriod(p)} className="flex-1 rounded-full py-1.5 text-[12px] font-bold transition"
                style={{ background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent)" : "var(--text-hint)", border: `1px solid ${active ? "transparent" : "var(--border)"}` }}>
                {p}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4 cartes indicateurs */}
      <section className="grid grid-cols-2 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-3xl border bg-white p-3.5" style={{ borderColor: "var(--border)" }}>
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: c.soft }}>
                <Icon className="h-5 w-5" style={{ color: c.tint }} strokeWidth={1.85} aria-hidden="true" />
              </span>
              <p className="truncate text-[16px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>{c.value}</p>
              <p className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>{c.label}</p>
              <p className="text-[11px]" style={{ color: "var(--text-hint)" }}>{c.sub}</p>
            </div>
          );
        })}
      </section>

      {/* Dernières factures */}
      <section className="rounded-3xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Dernières factures</h2>
          <Link href="/budget/documents" className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>Voir tout</Link>
        </div>
        {invoices.length === 0 ? (
          <p className="py-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucune facture enregistrée.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {invoices.map((inv) => {
              const st = invoiceStatus(inv.statusKey);
              return (
                <li key={inv.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{inv.label}</p>
                    <p className="truncate text-[11.5px]" style={{ color: "var(--text-hint)" }}>
                      {inv.correspondent ? `${inv.correspondent} · ` : ""}{inv.dateLabel}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-extrabold" style={{ color: "var(--text-main)" }}>{euros(inv.amount)}</p>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-hint)" }} strokeWidth={2} aria-hidden="true" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
