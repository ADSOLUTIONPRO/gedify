"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import type { FinancialKind } from "@/lib/budget/financial-item-types";

type AddFinancialItemButtonProps = {
  kind: FinancialKind;
  label: string;
  color: string;
};

/**
 * Bouton + formulaire d'ajout d'un FinancialItem (revenu / dépense / dette).
 * Poste vers l'API budget existante (`POST /api/budget/financial-items`).
 */
export function AddFinancialItemButton({ kind, label, color }: AddFinancialItemButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", amount: "", date: "", correspondent: "", category: "", notes: "" });

  const direction = kind === "revenue" ? "incoming" : "outgoing";

  async function submit() {
    const amount = Number(form.amount.replace(",", "."));
    if (!form.label.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Libellé et montant valides requis.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/budget/financial-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          direction,
          label: form.label.trim(),
          amount,
          currency: "EUR",
          documentDate: form.date || null,
          dueDate: kind === "debt" ? form.date || null : null,
          correspondentName: form.correspondent.trim() || null,
          categoryName: form.category.trim() || null,
          notes: form.notes.trim(),
          status: "validated",
          validationStatus: "validated",
          isAiDetected: false,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOpen(false);
      setForm({ label: "", amount: "", date: "", correspondent: "", category: "", notes: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-white transition hover:opacity-90"
        style={{ background: color }}
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => !busy && setOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>{label}</h2>
              <button type="button" onClick={() => !busy && setOpen(false)} aria-label="Fermer" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { k: "label" as const, ph: "Libellé", type: "text" },
                { k: "amount" as const, ph: "Montant (€)", type: "text" },
                { k: "date" as const, ph: "Date", type: "date" },
                { k: "correspondent" as const, ph: "Correspondant (optionnel)", type: "text" },
                { k: "category" as const, ph: "Catégorie (optionnel)", type: "text" },
              ].map((f) => (
                <input
                  key={f.k}
                  type={f.type}
                  value={form[f.k]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))}
                  placeholder={f.ph}
                  className="h-9 w-full rounded-lg border px-2.5 text-[13px] outline-none focus:border-blue-400"
                  style={{ borderColor: "var(--border)" }}
                />
              ))}
              <textarea
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Notes (optionnel)"
                rows={2}
                className="w-full rounded-lg border px-2.5 py-2 text-[13px] outline-none focus:border-blue-400"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            {error ? <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--danger)" }}>{error}</p> : null}
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={busy} onClick={submit} className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: color }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
