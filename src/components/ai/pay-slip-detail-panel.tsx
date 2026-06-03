"use client";

import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  Loader2,
  Plus,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PaySlipRichData } from "@/lib/ai/pay-slip-types";
import { isPaySlipRichData } from "@/lib/ai/pay-slip-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function val(value: string | null | undefined): string {
  return value?.trim() || "—";
}

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-36">
        {label}
      </dt>
      <dd className="flex-1 text-right text-sm font-semibold text-slate-800 break-words">
        {value}
      </dd>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        {title}
      </h3>
      <dl className="space-y-0.5">{children}</dl>
    </div>
  );
}

// ─── Amount badge ─────────────────────────────────────────────────────────────

function AmountBadge({
  label,
  amount,
  highlight,
}: {
  label: string;
  amount: number | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-2 ${
        highlight
          ? "bg-emerald-50 border border-emerald-200"
          : "bg-slate-50 border border-slate-200"
      }`}
    >
      <span className={`text-xs font-semibold ${highlight ? "text-emerald-700" : "text-slate-600"}`}>
        {label}
      </span>
      <span
        className={`text-sm font-bold ${highlight ? "text-emerald-800" : "text-slate-700"}`}
      >
        {fmt(amount)}
      </span>
    </div>
  );
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type ActionButtonProps = {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  busy?: boolean;
  variant?: "primary" | "secondary" | "emerald";
};

function ActionButton({ icon: Icon, label, onClick, busy, variant = "secondary" }: ActionButtonProps) {
  const cls = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    emerald: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  }[variant];
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${cls}`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
      ) : (
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  documentId: number;
  analysisId: string;
  richData: Record<string, unknown> | null | undefined;
  suggestedCorrespondentName?: string | null;
};

type Feedback = { kind: "success" | "error"; message: string } | null;

export function PaySlipDetailPanel({ documentId, richData, suggestedCorrespondentName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const data = isPaySlipRichData(richData) ? richData as PaySlipRichData : null;

  if (!data) return null;

  const { employee, employer, payPeriod, amounts, payment, secondaryOrganisms } = data;
  const employerName = employer.name ?? suggestedCorrespondentName ?? null;

  async function action(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ kind: "success", message: `${label} effectué.` });
      router.refresh();
    } catch (err) {
      setFeedback({ kind: "error", message: err instanceof Error ? err.message : `${label} impossible.` });
    } finally {
      setBusy(null);
    }
  }

  async function createCorrespondent() {
    if (!employerName) return;
    const res = await fetch("/api/paperless/correspondents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: employerName }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(d.error ?? `HTTP ${res.status}`);
    }
  }

  async function applyDocumentType() {
    const res = await fetch("/api/paperless/document-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: "Bulletin de salaire" }),
    });
    if (!res.ok) {
      // Type might already exist — that's OK
      const d = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(d.error ?? `HTTP ${res.status}`);
    }
    // Apply to document
    const typeData = (await res.json()) as { id?: number };
    if (typeData.id) {
      await fetch(`/api/paperless/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ document_type: typeData.id }),
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-700">
          Données extraites — Bulletin de salaire
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          IA avancée
        </span>
      </div>

      {/* Employer */}
      <Section icon={Building2} title="Employeur">
        <FieldRow label="Raison sociale" value={val(employer.name)} />
        <FieldRow label="SIRET" value={val(employer.siret)} />
        <FieldRow label="Code APE" value={val(employer.apeCode)} />
        <FieldRow label="URSSAF" value={val(employer.urssafNumber)} />
        {employer.address ? <FieldRow label="Adresse" value={val(employer.address)} /> : null}
      </Section>

      {/* Employee */}
      <Section icon={User} title="Salarié">
        <FieldRow label="Nom" value={val(employee.name)} />
        <FieldRow label="Poste" value={val(employee.job)} />
        <FieldRow label="Qualification" value={val(employee.qualification)} />
        <FieldRow label="Convention" value={val(employee.collectiveAgreement)} />
        <FieldRow label="Entrée" value={val(employee.entryDate)} />
      </Section>

      {/* Pay period */}
      <Section icon={Calendar} title="Période de paie">
        <FieldRow label="Début" value={val(payPeriod.start)} />
        <FieldRow label="Fin" value={val(payPeriod.end)} />
        <FieldRow label="Date paiement" value={val(payPeriod.paymentDate)} />
      </Section>

      {/* Amounts */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
          <Coins className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Rémunération
        </h3>
        <div className="space-y-2">
          <AmountBadge label="Salaire brut" amount={amounts.grossSalary} />
          <AmountBadge label="Cotisations salariales" amount={amounts.employeeContributions} />
          <AmountBadge label="Net imposable" amount={amounts.netTaxable} />
          <AmountBadge label="NET À PAYER" amount={amounts.netToPay} highlight />
          {amounts.employerCost ? (
            <AmountBadge label="Coût employeur" amount={amounts.employerCost} />
          ) : null}
        </div>
      </div>

      {/* Payment */}
      {(payment.method || payment.amount) ? (
        <Section icon={CreditCard} title="Paiement">
          <FieldRow label="Mode" value={val(payment.method)} />
          <FieldRow label="Montant viré" value={fmt(payment.amount)} />
          <FieldRow label="Date" value={val(payment.date)} />
        </Section>
      ) : null}

      {/* Secondary organisms */}
      {secondaryOrganisms.length > 0 ? (
        <Section icon={Briefcase} title="Organismes secondaires">
          <div className="flex flex-wrap gap-1.5 pt-1">
            {secondaryOrganisms.map((org) => (
              <span
                key={org}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
              >
                {org}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Action buttons */}
      <div className="rounded-2xl border border-slate-200/60 bg-slate-50 p-3">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Actions disponibles
        </p>
        <div className="flex flex-wrap gap-2">
          {employerName ? (
            <ActionButton
              icon={Plus}
              label={`Créer correspondant "${employerName}"`}
              variant="primary"
              busy={busy === "correspondant"}
              onClick={() =>
                action("correspondant", createCorrespondent)
              }
            />
          ) : null}

          <ActionButton
            icon={Coins}
            label="Type : Bulletin de salaire"
            variant="secondary"
            busy={busy === "type"}
            onClick={() => action("type", applyDocumentType)}
          />
        </div>

        {feedback ? (
          <p
            className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${
              feedback.kind === "success" ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {feedback.kind === "success" ? (
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            )}
            {feedback.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
