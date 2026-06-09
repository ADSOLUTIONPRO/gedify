"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import {
  KIND_LABELS,
  KIND_TO_DIRECTION,
  STATUS_LABELS,
  type FinancialItemStatus,
  type FinancialKind,
} from "@/lib/budget/financial-item-types";

/** Catégories proposées dans la répartition (sous-ensemble pertinent + français). */
const KIND_OPTIONS: FinancialKind[] = [
  "expense", "debt", "fee", "tax", "penalty", "revenue", "refund", "reimbursement", "benefit", "salary", "other",
];
const STATUS_OPTIONS: FinancialItemStatus[] = [
  "to_review", "unpaid", "upcoming_expense", "paid", "partially_paid", "overdue", "scheduled", "disputed", "validated",
];

type Line = {
  id: string;
  label: string;
  amount: number;
  kind: FinancialKind;
  status: FinancialItemStatus;
  date: string;
  correspondentName: string;
  include: boolean;
};

export type BreakdownSeed = { label: string; amount: number; currency?: string };

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** Devine la catégorie depuis le libellé. */
function guessKind(label: string): FinancialKind {
  const l = label.toLowerCase();
  if (/tva|t\.v\.a/.test(l)) return "tax";
  if (/frais/.test(l)) return "fee";
  if (/int[ée]r[êe]t|p[ée]nalit/.test(l)) return "penalty";
  if (/salaire|net à payer|net a payer|paie/.test(l)) return "salary";
  if (/rembours/.test(l)) return "refund";
  if (/dette|reste|solde|d[uû]\b/.test(l)) return "debt";
  return "expense";
}

/** Rôle d'une ligne pour le contrôle de cohérence (principal/tva/frais/intérêts/payé/reste). */
function roleOf(label: string): "principal" | "tva" | "frais" | "interets" | "paye" | "reste" | null {
  const l = label.toLowerCase();
  if (/reste|solde/.test(l)) return "reste";
  if (/pay[ée]|acompte|d[ée]j[àa]|vers[ée]|r[ée]gl[ée]/.test(l)) return "paye";
  if (/tva|t\.v\.a/.test(l)) return "tva";
  if (/frais/.test(l)) return "frais";
  if (/int[ée]r[êe]t/.test(l)) return "interets";
  if (/principal|capital|montant d[ûu]|montant r[ée]clam/.test(l)) return "principal";
  return null;
}

const inputCls = "h-8 w-full rounded-lg border px-2 text-[12px] outline-none focus:border-[var(--accent)]";

/**
 * Éditeur « Répartition des montants » (§6) : une ligne par montant détecté
 * (libellé / montant / catégorie / statut / date / correspondant / inclure),
 * contrôle de cohérence (reste dû = principal + TVA + frais + intérêts − payé),
 * et création d'une entrée budget par ligne incluse.
 */
export function AmountBreakdownEditor({
  documentId,
  seeds,
  defaultDate = "",
  defaultCorrespondent = "",
  onCreated,
}: {
  documentId: number;
  seeds: BreakdownSeed[];
  defaultDate?: string;
  defaultCorrespondent?: string;
  onCreated?: (count: number) => void;
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    seeds.length > 0
      ? seeds.map((s) => ({
          id: uid(),
          label: s.label,
          amount: s.amount,
          kind: guessKind(s.label),
          status: "to_review" as FinancialItemStatus,
          date: defaultDate,
          correspondentName: defaultCorrespondent,
          include: true,
        }))
      : [],
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Confirmation + suppression réelle (tombstone) d'une ligne.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currency = seeds[0]?.currency ?? "EUR";

  // Au montage : retire de la répartition les montants supprimés manuellement
  // (tombstones), pour qu'une donnée effacée ne réapparaisse pas à la réouverture.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/budget-breakdown`, { method: "GET", credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as {
          removedFromBudget?: boolean;
          deletions?: { scope: string; amount?: number | null }[];
        };
        if (cancelled) return;
        if (data.removedFromBudget) { setLines([]); return; }
        const cents = (n: number) => Math.round(n * 100);
        const tomb = new Set((data.deletions ?? []).filter((d) => d.scope === "amount" && d.amount != null).map((d) => cents(d.amount as number)));
        if (tomb.size > 0) setLines((prev) => prev.filter((l) => !tomb.has(cents(l.amount || 0))));
      } catch {
        /* best-effort : en cas d'échec on garde les seeds */
      }
    })();
    return () => { cancelled = true; };
  }, [documentId]);

  function update(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setDone(null);
  }

  /**
   * Supprime réellement la donnée : pose un tombstone côté serveur (la ligne ne
   * sera ni recréée par l'IA ni ré-affichée) et retire toute ligne budget
   * persistée correspondante. Les lignes vierges (montant 0) sont retirées
   * localement sans appel réseau.
   */
  async function remove(id: string) {
    const line = lines.find((l) => l.id === id);
    setConfirmId(null);
    if (!line || !line.amount) {
      setLines((prev) => prev.filter((l) => l.id !== id));
      return;
    }
    setDeletingId(id);
    try {
      await fetch(`/api/documents/${documentId}/budget-breakdown`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: line.amount, kind: line.kind, label: line.label || null }),
      }).catch(() => {});
      setLines((prev) => prev.filter((l) => l.id !== id));
      onCreated?.(0);
    } finally {
      setDeletingId(null);
    }
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      { id: uid(), label: "", amount: 0, kind: "expense", status: "to_review", date: defaultDate, correspondentName: defaultCorrespondent, include: true },
    ]);
  }

  // ── Cohérence : reste dû ≈ principal + TVA + frais + intérêts − payé ──
  const coherence = useMemo(() => {
    const sum = (role: string) => lines.filter((l) => roleOf(l.label) === role).reduce((a, l) => a + (l.amount || 0), 0);
    const reste = lines.find((l) => roleOf(l.label) === "reste");
    if (!reste) return null;
    const expected = sum("principal") + sum("tva") + sum("frais") + sum("interets") - sum("paye");
    const ok = Math.abs(expected - (reste.amount || 0)) < 0.01;
    return { ok, expected, actual: reste.amount || 0 };
  }, [lines]);

  const includedTotal = lines.filter((l) => l.include).reduce((a, l) => a + (l.amount || 0), 0);
  const includedCount = lines.filter((l) => l.include).length;

  // « Retirer du budget » (document-scope) : supprime toutes les lignes
  // persistées du document et pose un tombstone document (l'IA ne reclasse plus
  // ce document au budget tant que l'utilisateur ne crée pas une ligne).
  const [removingDoc, setRemovingDoc] = useState(false);
  const [confirmRemoveDoc, setConfirmRemoveDoc] = useState(false);
  async function removeFromBudget() {
    setRemovingDoc(true);
    try {
      await fetch(`/api/documents/${documentId}/budget-breakdown`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      }).catch(() => {});
      setLines([]);
      setConfirmRemoveDoc(false);
      onCreated?.(0);
    } finally {
      setRemovingDoc(false);
    }
  }

  async function createAll() {
    if (busy || includedCount === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/budget-breakdown`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            label: l.label,
            amount: l.amount,
            currency,
            kind: l.kind,
            status: l.status,
            date: l.date || null,
            correspondentName: l.correspondentName || null,
            include: l.include,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { created?: unknown[]; message?: string; error?: string };
      if (!res.ok) { setError(data.message || data.error || "Création impossible."); return; }
      const count = data.created?.length ?? 0;
      setDone(count);
      onCreated?.(count);
    } catch {
      setError("Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {lines.length === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun montant détecté. Ajoutez une ligne pour répartir manuellement.</p>
      ) : (
        <div className="space-y-1.5">
          {lines.map((l) => {
            const dir = KIND_TO_DIRECTION[l.kind];
            return (
              <div key={l.id} className="rounded-xl border p-2" style={{ borderColor: "var(--border)", background: l.include ? "var(--surface)" : "var(--bg-card-soft)" }}>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={l.include}
                    onChange={(e) => update(l.id, { include: e.target.checked })}
                    aria-label="Inclure au budget"
                    className="h-4 w-4 shrink-0 rounded accent-[var(--accent)]"
                  />
                  <input
                    value={l.label}
                    onChange={(e) => update(l.id, { label: e.target.value })}
                    placeholder="Libellé (ex. Montant principal)"
                    className={`${inputCls} flex-1`}
                    style={{ borderColor: "var(--border)" }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={l.amount}
                    onChange={(e) => update(l.id, { amount: Number(e.target.value) })}
                    className={`${inputCls} w-24 text-right`}
                    style={{ borderColor: "var(--border)" }}
                  />
                  <span className="text-[10px]" style={{ color: dir === "incoming" ? "#15803D" : dir === "outgoing" ? "#B45309" : "var(--text-hint)" }}>{currency}</span>
                  {confirmId === l.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => setConfirmId(null)} className="inline-flex h-7 items-center rounded-lg border px-2 text-[11px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Annuler</button>
                      <button type="button" onClick={() => void remove(l.id)} disabled={deletingId === l.id} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-white disabled:opacity-50" style={{ background: "var(--danger)" }}>
                        {deletingId === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Supprimer
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmId(l.id)} aria-label="Supprimer la donnée financière" title="Supprimer la donnée financière" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.85} />
                    </button>
                  )}
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <select value={l.kind} onChange={(e) => update(l.id, { kind: e.target.value as FinancialKind })} className={inputCls} style={{ borderColor: "var(--border)" }} aria-label="Catégorie">
                    {KIND_OPTIONS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                  </select>
                  <select value={l.status} onChange={(e) => update(l.id, { status: e.target.value as FinancialItemStatus })} className={inputCls} style={{ borderColor: "var(--border)" }} aria-label="Statut">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                  <input type="date" value={l.date} onChange={(e) => update(l.id, { date: e.target.value })} className={inputCls} style={{ borderColor: "var(--border)" }} aria-label="Date" />
                  <input value={l.correspondentName} onChange={(e) => update(l.id, { correspondentName: e.target.value })} placeholder="Correspondant" className={inputCls} style={{ borderColor: "var(--border)" }} aria-label="Correspondant" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addLine} className="inline-flex h-8 items-center gap-1 rounded-lg border border-dashed px-2.5 text-[11.5px] font-bold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Ajouter une ligne
        </button>
        <span className="ml-auto text-[12px] font-bold" style={{ color: "var(--text-main)" }}>
          Total inclus : {includedTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
        </span>
      </div>

      {/* Contrôle de cohérence */}
      {coherence ? (
        coherence.ok ? (
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "#15803D" }}>
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Répartition cohérente (reste dû = principal + frais − payé).
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "#B45309" }}>
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} /> Incohérence : reste dû attendu {coherence.expected.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}, saisi {coherence.actual.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}.
          </p>
        )
      ) : null}

      {error ? <p className="text-[11.5px] font-semibold" style={{ color: "#DC2626" }}>{error}</p> : null}
      {done != null ? <p className="text-[11.5px] font-semibold" style={{ color: "#15803D" }}>{done} ligne(s) ajoutée(s) au budget.</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void createAll()}
          disabled={busy || includedCount === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" strokeWidth={2} />}
          Créer {includedCount > 0 ? `${includedCount} ` : ""}ligne(s) au budget
        </button>

        {confirmRemoveDoc ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl border px-2 py-1 text-[11.5px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            Retirer ce document du budget ?
            <button type="button" onClick={() => setConfirmRemoveDoc(false)} className="inline-flex h-7 items-center rounded-lg border px-2 font-semibold" style={{ borderColor: "var(--border)" }}>Annuler</button>
            <button type="button" onClick={() => void removeFromBudget()} disabled={removingDoc} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 font-bold text-white disabled:opacity-50" style={{ background: "var(--danger)" }}>
              {removingDoc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" strokeWidth={2} />} Retirer
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmRemoveDoc(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold transition hover:bg-rose-50" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.85} /> Retirer du budget
          </button>
        )}
      </div>
    </div>
  );
}
