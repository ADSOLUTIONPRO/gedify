"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Wallet } from "lucide-react";
import { KIND_LABELS, STATUS_LABELS, type FinancialKind, type FinancialItemStatus } from "@/lib/budget/financial-item-types";

type FinancialItem = {
  id: string;
  kind: FinancialKind;
  label: string;
  amount: number;
  currency: string;
  budgetMonth: string | null;
  status: FinancialItemStatus;
  sourceDocumentId: number | null;
};

/** Sous-ensemble pertinent pour un document (le store en gère bien plus). */
const KIND_OPTIONS: FinancialKind[] = ["expense", "revenue", "debt", "refund", "reimbursement", "tax", "benefit", "salary", "other"];
const STATUS_OPTIONS: FinancialItemStatus[] = ["unpaid", "upcoming_expense", "paid", "overdue", "scheduled", "to_review", "validated"];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Props = {
  documentId: number;
  defaultLabel: string;
  aiAmount?: { amount: number; currency: string } | null;
};

/**
 * Ligne budget compacte reliée au store financier existant
 * (`/api/budget/financial-items`, filtre `documentId`). Affiche l'item lié s'il
 * existe (édition inline type/montant/mois/statut), sinon « Ajouter au budget ».
 */
export function DocumentBudgetLine({ documentId, defaultLabel, aiAmount }: Props) {
  const [item, setItem] = useState<FinancialItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/budget/financial-items?documentId=${documentId}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: FinancialItem[] }) => {
        if (!cancelled) setItem(d.items?.[0] ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function create() {
    if (busy) return;
    setBusy(true);
    setStatus("Ajout au budget…");
    try {
      const res = await fetch("/api/budget/financial-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceDocumentId: documentId,
          sourceDocumentTitle: defaultLabel,
          label: defaultLabel,
          kind: "expense",
          amount: aiAmount?.amount ?? 0,
          currency: aiAmount?.currency ?? "EUR",
          budgetMonth: currentMonth(),
          status: "to_review",
        }),
      });
      if (res.ok) {
        const { item: created } = (await res.json()) as { item: FinancialItem };
        setItem(created);
        setStatus("Ajouté au budget");
      } else {
        setStatus("Ajout impossible");
      }
    } catch {
      setStatus("Ajout impossible");
    } finally {
      setBusy(false);
    }
  }

  async function patch(patch: Partial<FinancialItem>) {
    if (!item || busy) return;
    setBusy(true);
    setStatus("Enregistrement…");
    const prev = item;
    const next = { ...item, ...patch };
    setItem(next);
    try {
      const res = await fetch(`/api/budget/financial-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      setStatus("Enregistré");
    } catch {
      setItem(prev);
      setStatus("Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Chargement…
      </p>
    );
  }

  if (!item) {
    return (
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed text-[12.5px] font-bold transition hover:bg-[#FCFAF7] disabled:opacity-50"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
        Ajouter au budget
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Wallet className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={1.75} aria-hidden="true" />
        <select value={item.kind} onChange={(e) => void patch({ kind: e.target.value as FinancialKind })} disabled={busy} className="h-8 rounded-lg border px-2 text-[12px]" style={{ borderColor: "var(--border)" }}>
          {KIND_OPTIONS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
        <input
          type="number"
          step="0.01"
          value={item.amount}
          onChange={(e) => setItem({ ...item, amount: Number(e.target.value) })}
          onBlur={(e) => void patch({ amount: Number(e.target.value) })}
          disabled={busy}
          className="h-8 w-24 rounded-lg border px-2 text-[12px]"
          style={{ borderColor: "var(--border)" }}
        />
        <span className="text-[11px]" style={{ color: "var(--text-hint)" }}>{item.currency}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="month"
          value={item.budgetMonth ?? ""}
          onChange={(e) => void patch({ budgetMonth: e.target.value })}
          disabled={busy}
          className="h-8 rounded-lg border px-2 text-[12px]"
          style={{ borderColor: "var(--border)" }}
        />
        <select value={item.status} onChange={(e) => void patch({ status: e.target.value as FinancialItemStatus })} disabled={busy} className="h-8 rounded-lg border px-2 text-[12px]" style={{ borderColor: "var(--border)" }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <Link href="/finances" className="ml-auto text-[11.5px] font-bold" style={{ color: "var(--accent)" }}>
          Voir dans Finances →
        </Link>
      </div>
      {status ? <p className="text-[11px]" style={{ color: "var(--text-muted)" }} role="status">{status}</p> : null}
    </div>
  );
}
