"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowDownLeft,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddRevenueModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );

  const [label, setLabel] = useState("");
  const [source, setSource] = useState("autre");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState<
    "one-shot" | "weekly" | "monthly" | "quarterly" | "yearly"
  >("one-shot");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"planned" | "received" | "to-pay">("planned");
  const [notes, setNotes] = useState("");

  async function submit() {
    setSubmitting(true);
    setFeedback(null);
    try {
      const amountValue = Number.parseFloat(amount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        throw new Error("Montant invalide.");
      }
      const response = await fetch("/api/budget/revenues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || "Nouveau revenu",
          source,
          amount: amountValue,
          currency: "EUR",
          date,
          recurrence,
          category: category || null,
          status,
          notes,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      setFeedback({ kind: "success", message: "Revenu créé." });
      setLabel("");
      setSource("autre");
      setAmount("");
      setRecurrence("one-shot");
      setCategory("");
      setStatus("planned");
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
      <Button onClick={() => setOpen(true)} variant="success" size="sm" icon={ArrowDownLeft}>
        Ajouter revenu
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
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100"
                >
                  <ArrowDownLeft className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Nouveau revenu</p>
                  <p className="text-[11px] text-slate-500">
                    Saisie manuelle. Lettrage avec un bulletin de salaire ou avis CAF à venir.
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
                  placeholder="Ex. Salaire juin"
                  className={inputClass}
                />
              </Field>
              <Field label="Source">
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className={inputClass}
                >
                  <option value="salaire">Salaire</option>
                  <option value="caf">CAF</option>
                  <option value="cpam">CPAM</option>
                  <option value="remboursement">Remboursement</option>
                  <option value="indemnite">Indemnité</option>
                  <option value="aide-sociale">Aide sociale</option>
                  <option value="virement">Virement</option>
                  <option value="autre">Autre</option>
                </select>
              </Field>
              <Field label="Montant" required>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Date de perception">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Récurrence">
                <select
                  value={recurrence}
                  onChange={(e) =>
                    setRecurrence(
                      e.target.value as
                        | "one-shot"
                        | "weekly"
                        | "monthly"
                        | "quarterly"
                        | "yearly",
                    )
                  }
                  className={inputClass}
                >
                  <option value="one-shot">Ponctuel</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                  <option value="quarterly">Trimestriel</option>
                  <option value="yearly">Annuel</option>
                </select>
              </Field>
              <Field label="Catégorie">
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex. Salaire, Aide…"
                  className={inputClass}
                />
              </Field>
              <Field label="Statut">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "planned" | "received" | "to-pay")}
                  className={inputClass}
                >
                  <option value="planned">Prévu</option>
                  <option value="received">Reçu</option>
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
                disabled={submitting || !amount}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)] hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                )}
                Créer le revenu
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
