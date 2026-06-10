"use client";

import { useState } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type ResetScope = "ai" | "finances" | "actions" | "suggestions" | "all-internal";

type ResetResult = {
  ok: true;
  scope: ResetScope;
  deleted: Record<string, number>;
  preserved: Record<string, boolean>;
};

const SCOPE_CONFIG: Record<
  ResetScope,
  { label: string; description: string; confirmText: string; tone: "danger" | "warning" }
> = {
  ai: {
    label: "Réinitialiser l'historique IA",
    description: "Supprime toutes les analyses IA, infos détectées et mémoire de corrections.",
    confirmText: "RESET",
    tone: "warning",
  },
  finances: {
    label: "Réinitialiser les finances détectées",
    description: "Supprime les lignes financières non validées générées par IA.",
    confirmText: "RESET",
    tone: "warning",
  },
  actions: {
    label: "Réinitialiser les actions / rappels IA",
    description: "Supprime les actions IA non terminées et leurs rappels associés.",
    confirmText: "RESET",
    tone: "warning",
  },
  suggestions: {
    label: "Réinitialiser les suggestions",
    description: "Supprime les analyses IA et infos détectées (sans la mémoire de corrections).",
    confirmText: "RESET",
    tone: "warning",
  },
  "all-internal": {
    label: "Réinitialisation complète de Gedify",
    description:
      "Supprime tout l'historique interne : IA, finances, actions, rappels, suggestions, mémoire. Les documents Gedify, tags, correspondants, types, utilisateurs et paramètres sont conservés.",
    confirmText: "RESET_GED_INTERNAL_DATA",
    tone: "danger",
  },
};

type Props = {
  scope: ResetScope;
};

export function ScopedResetButton({ scope }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = SCOPE_CONFIG[scope];

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ scope, confirm: config.confirmText }),
      });
      const data = (await res.json()) as ResetResult | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
      setResult(data as ResetResult);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const totalDeleted = result
    ? Object.values(result.deleted).reduce((sum, n) => sum + n, 0)
    : 0;

  const borderColor = config.tone === "danger" ? "#FCA5A5" : "#FDE68A";
  const textColor = config.tone === "danger" ? "#DC2626" : "#D97706";
  const hoverBg = config.tone === "danger" ? "hover:bg-rose-50" : "hover:bg-amber-50";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${hoverBg}`}
          style={{ borderColor, color: textColor }}
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {config.label}
        </button>

        {result && (
          <p className="text-[13px] font-semibold" style={{ color: "#16A34A" }}>
            ✓ Terminé — {totalDeleted} entrée(s) supprimée(s)
          </p>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {result && (
        <ul className="grid gap-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
          {Object.entries(result.deleted).map(([key, val]) => (
            <li key={key}>{key} : <strong>{val}</strong></li>
          ))}
        </ul>
      )}

      <ConfirmActionDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void run()}
        variant={config.tone === "danger" ? "delete" : "warning"}
        title={config.label}
        description={config.description}
        confirmLabel="Réinitialiser"
        requireTextConfirmation
        itemName={config.confirmText}
        loading={loading}
      />
    </div>
  );
}
