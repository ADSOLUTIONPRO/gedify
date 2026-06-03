"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  XCircle,
} from "lucide-react";

type Props = {
  itemId: string;
};

export function FinancialItemQuickActions({ itemId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"validate" | "ignore" | null>(null);

  async function apply(action: "validate" | "ignore") {
    setBusy(action);
    try {
      const body =
        action === "validate"
          ? {
              validationStatus: "validated",
              status: "validated",
              validatedAt: new Date().toISOString(),
            }
          : {
              validationStatus: "ignored",
              status: "ignored",
              ignoredAt: new Date().toISOString(),
            };
      const res = await fetch(`/api/budget/financial-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      // best-effort; the user can retry
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => apply("validate")}
        disabled={busy !== null}
        className="inline-flex h-7 items-center gap-1 rounded-lg bg-gradient-to-b from-emerald-600 to-emerald-700 px-2 text-[11px] font-semibold text-white shadow-[0_4px_12px_-6px_rgba(16,185,129,0.5)] hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60"
      >
        {busy === "validate" ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        )}
        Valider
      </button>
      <button
        type="button"
        onClick={() => apply("ignore")}
        disabled={busy !== null}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy === "ignore" ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          <XCircle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        )}
        Ignorer
      </button>
      <button
        type="button"
        onClick={() => router.push(`/ia/financial-items/${itemId}`)}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
      >
        <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        Modifier
      </button>
    </div>
  );
}
