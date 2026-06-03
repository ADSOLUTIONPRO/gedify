"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Coins,
  Loader2,
  Pencil,
  XCircle,
} from "lucide-react";
import { formatMoney } from "@/lib/format-money";
import type { AIFinancialImpact } from "@/lib/ai/types";
import {
  KIND_LABELS,
  type FinancialKind,
} from "@/lib/budget/financial-item-types";

type Props = {
  analysisId: string;
  impactIndex: number;
  impact: AIFinancialImpact;
  suggestedKind: FinancialKind;
  suggestedBudgetMonth: string;
  suggestedDueDate?: string | null;
  suggestedDocumentDate?: string | null;
  suggestedLabel?: string;
  suggestedCorrespondentName?: string | null;
  documentTitle?: string | null;
};

type Feedback = { kind: "success" | "error"; message: string } | null;

const KIND_OPTIONS: FinancialKind[] = [
  "revenue",
  "expense",
  "debt",
  "due_payment",
  "refund",
  "credit",
  "tax",
  "fee",
  "subscription",
  "loan",
  "installment",
  "reimbursement",
  "benefit",
  "salary",
  "allowance",
  "penalty",
  "disputed_amount",
  "other",
];

export function FinancialExtractionReview({
  analysisId,
  impactIndex,
  impact,
  suggestedKind,
  suggestedBudgetMonth,
  suggestedDueDate,
  suggestedDocumentDate,
  suggestedLabel,
  suggestedCorrespondentName,
  documentTitle,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Editable form state
  const [kind, setKind] = useState<FinancialKind>(suggestedKind);
  const [label, setLabel] = useState<string>(suggestedLabel ?? `${impact.creditor ?? "Document"}`);
  const [amount, setAmount] = useState<string>(impact.amount.toString());
  const [amountPaid, setAmountPaid] = useState<string>("0");
  const [budgetMonth, setBudgetMonth] = useState<string>(suggestedBudgetMonth);
  const [dueDate, setDueDate] = useState<string>(suggestedDueDate ?? "");
  const [documentDate, setDocumentDate] = useState<string>(suggestedDocumentDate ?? "");
  const [correspondentName, setCorrespondentName] = useState<string>(
    suggestedCorrespondentName ?? impact.creditor ?? "",
  );
  const [categoryName, setCategoryName] = useState<string>(impact.category ?? "");
  const [notes, setNotes] = useState<string>("");
  const [createActionToo, setCreateActionToo] = useState<boolean>(!!suggestedDueDate);

  async function call(label: string, url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, data };
  }

  async function quickAdd(targetKind: FinancialKind) {
    setBusy("Ajout");
    setFeedback(null);
    try {
      const parsedAmount = Number.parseFloat(amount);
      const { ok, data } = await call("validate", "/api/budget/validate-financial-extraction", {
        analysisId,
        impactIndex,
        overrides: {
          kind: targetKind,
          label,
          amount: Number.isFinite(parsedAmount) ? parsedAmount : impact.amount,
          budgetMonth,
          dueDate: dueDate || null,
          documentDate: documentDate || null,
          correspondentName: correspondentName || null,
          categoryName: categoryName || null,
          notes,
          sourceDocumentTitle: documentTitle ?? null,
        },
      });
      if (!ok) {
        throw new Error((data.error as string) ?? "Validation impossible");
      }
      setFeedback({
        kind: "success",
        message: `${KIND_LABELS[targetKind]} ajouté au budget.`,
      });
      if (createActionToo && dueDate) {
        try {
          await fetch("/api/actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: `Payer ${label} (${formatMoney(Number.parseFloat(amount))})`,
              type: "to-pay",
              dueDate,
              amount: Number.parseFloat(amount),
              createdFrom: "ai",
            }),
          });
        } catch {
          // best effort
        }
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Validation impossible",
      });
    } finally {
      setBusy(null);
    }
  }

  async function ignore() {
    setBusy("Ignore");
    setFeedback(null);
    try {
      const { ok, data } = await call("ignore", "/api/budget/ignore-financial-extraction", {
        analysisId,
        impactIndex,
      });
      if (!ok) throw new Error((data.error as string) ?? "Action impossible");
      setFeedback({ kind: "success", message: "Suggestion ignorée." });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Action impossible",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3.5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <Coins className="h-3 w-3 text-emerald-600" strokeWidth={2} aria-hidden="true" />
            {KIND_LABELS[suggestedKind]}
            {impact.recurrence ? (
              <span className="text-slate-400">· {impact.recurrence}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-lg font-extrabold text-slate-900">
            {formatMoney(impact.amount, impact.currency)}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
            {impact.creditor ? `Créancier : ${impact.creditor}` : null}
            {impact.dueDate ? ` · Échéance ${new Date(impact.dueDate).toLocaleDateString("fr-FR")}` : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          {open ? "Fermer" : "Modifier"}
        </button>
      </div>

      {!open ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button onClick={() => quickAdd(suggestedKind)} busy={busy === "Ajout"} variant="primary">
            Ajouter au budget
          </Button>
          <Button onClick={() => quickAdd("revenue")} busy={false}>
            comme Revenu
          </Button>
          <Button onClick={() => quickAdd("expense")} busy={false}>
            comme Dépense
          </Button>
          <Button onClick={() => quickAdd("debt")} busy={false}>
            comme Dette
          </Button>
          <Button onClick={() => quickAdd("due_payment")} busy={false}>
            comme Échéance
          </Button>
          <Button onClick={ignore} busy={busy === "Ignore"} variant="ghost">
            Ignorer
          </Button>
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <Field label="Libellé">
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Type financier">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as FinancialKind)}
              className={inputClass}
            >
              {KIND_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {KIND_LABELS[entry]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Montant">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Déjà payé">
            <input
              type="number"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Date du document">
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Date d'échéance">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Mois budgétaire">
            <input
              type="month"
              value={budgetMonth}
              onChange={(e) => setBudgetMonth(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Correspondant">
            <input
              value={correspondentName}
              onChange={(e) => setCorrespondentName(e.target.value)}
              className={inputClass}
              placeholder="Ex. EDF, CAF…"
            />
          </Field>
          <Field label="Catégorie">
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className={inputClass}
              placeholder="Ex. Énergie, Salaire…"
            />
          </Field>
          <Field label="Notes" full>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputClass} resize-none py-2`}
            />
          </Field>

          {dueDate ? (
            <label className="col-span-full inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={createActionToo}
                onChange={(e) => setCreateActionToo(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
              />
              Créer aussi une action « payer avant le {new Date(dueDate).toLocaleDateString("fr-FR")} »
            </label>
          ) : null}

          <div className="col-span-full mt-2 flex flex-wrap gap-1.5">
            <Button onClick={() => quickAdd(kind)} busy={busy === "Ajout"} variant="primary">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Valider et ajouter
            </Button>
            <Button onClick={ignore} busy={busy === "Ignore"} variant="ghost">
              Ignorer
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {feedback ? (
        <p
          className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-1.5 text-[11px] font-semibold ${
            feedback.kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          ) : (
            <XCircle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </p>
      ) : null}

      <p className="mt-3 flex items-center gap-1 text-[10px] text-slate-400">
        <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        Les données détectées par IA doivent être vérifiées avant validation.
        {dueDate ? (
          <span className="ml-1 inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Mois budgétaire suggéré : {budgetMonth}
          </span>
        ) : null}
      </p>
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Button({
  onClick,
  busy,
  variant = "default",
  children,
}: {
  onClick: () => void;
  busy: boolean;
  variant?: "default" | "primary" | "ghost";
  children: React.ReactNode;
}) {
  const cls =
    variant === "primary"
      ? "bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-[0_4px_12px_-4px_rgba(37,99,235,0.4)] hover:from-blue-500 hover:to-blue-600"
      : variant === "ghost"
        ? "text-slate-600 hover:bg-slate-100"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex h-8 items-center gap-1 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-60 ${cls}`}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
