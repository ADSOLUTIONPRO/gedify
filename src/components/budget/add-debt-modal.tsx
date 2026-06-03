"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Coins, Loader2, Plus, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddDebtModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );

  // Form state
  const [label, setLabel] = useState("");
  const [creditor, setCreditor] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [remainingAmount, setRemainingAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [notes, setNotes] = useState("");

  async function submit() {
    setSubmitting(true);
    setFeedback(null);
    try {
      const initial = Number.parseFloat(initialAmount);
      if (!Number.isFinite(initial) || initial <= 0) {
        throw new Error("Montant initial invalide.");
      }
      const remaining = Number.parseFloat(remainingAmount);
      const response = await fetch("/api/budget/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || "Nouvelle dette",
          creditor: creditor.trim(),
          initialAmount: initial,
          remainingAmount: Number.isFinite(remaining) ? remaining : initial,
          currency: "EUR",
          dueDate: dueDate || null,
          monthlyPayment: monthlyPayment ? Number.parseFloat(monthlyPayment) : null,
          status: "to-pay",
          priority,
          notes,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      setFeedback({ kind: "success", message: "Dette créée." });
      // Reset and close
      setLabel("");
      setCreditor("");
      setInitialAmount("");
      setRemainingAmount("");
      setDueDate("");
      setMonthlyPayment("");
      setPriority("normal");
      setNotes("");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Création impossible.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="warning" size="sm" icon={Plus}>
        Ajouter dette
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
          />
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200/80 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100"
                >
                  <Coins className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Nouvelle dette</p>
                  <p className="text-[11px] text-slate-500">
                    Saisie manuelle. Vous pourrez lettrer un document plus tard.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <Field label="Libellé" required full>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex. Relance Trésor public"
                  className={inputClass}
                />
              </Field>
              <Field label="Créancier" required>
                <input
                  value={creditor}
                  onChange={(e) => setCreditor(e.target.value)}
                  placeholder="Ex. Centre des Finances Publiques"
                  className={inputClass}
                />
              </Field>
              <Field label="Échéance">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Montant initial" required>
                <input
                  type="number"
                  step="0.01"
                  value={initialAmount}
                  onChange={(e) => {
                    setInitialAmount(e.target.value);
                    if (!remainingAmount) setRemainingAmount(e.target.value);
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="Restant à payer">
                <input
                  type="number"
                  step="0.01"
                  value={remainingAmount}
                  onChange={(e) => setRemainingAmount(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Mensualité">
                <input
                  type="number"
                  step="0.01"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(e.target.value)}
                  className={inputClass}
                  placeholder="optionnel"
                />
              </Field>
              <Field label="Priorité">
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as "low" | "normal" | "high" | "urgent")
                  }
                  className={inputClass}
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </Field>
              <Field label="Notes" full>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none py-2`}
                />
              </Field>
              {feedback ? (
                <p
                  className={`col-span-full flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                    feedback.kind === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {feedback.kind === "success" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  )}
                  {feedback.message}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !initialAmount}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-600 to-amber-700 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(217,119,6,0.5)] hover:from-amber-500 hover:to-amber-600 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                )}
                Créer la dette
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const inputClass =
  "h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
