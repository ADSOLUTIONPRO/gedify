"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, PiggyBank } from "lucide-react";

type Flags = {
  financeSpaceEnabled: boolean;
  autoBudgetClassificationEnabled: boolean;
};

const DEFAULTS: Flags = { financeSpaceEnabled: true, autoBudgetClassificationEnabled: true };

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50"
      style={{ background: checked ? "#0B5CFF" : "#CBD5E1" }}
    >
      <span
        className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

/** Section « Modules et automatisations » des paramètres (réglages par instance). */
export function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<Flags>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof Flags | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/features", { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; flags?: Flags };
        if (!cancelled && data.flags) setFlags(data.flags);
      } catch {
        /* garde les valeurs par défaut */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function update(key: keyof Flags, value: boolean) {
    setSaving(key);
    setError(null);
    const previous = flags;
    setFlags((f) => ({ ...f, [key]: value })); // optimiste
    try {
      const res = await fetch("/api/settings/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = (await res.json()) as { ok?: boolean; flags?: Flags };
      if (!res.ok || !data.ok || !data.flags) throw new Error("Échec de l'enregistrement.");
      setFlags(data.flags);
    } catch (e) {
      setFlags(previous); // rollback
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(null);
    }
  }

  const rows: { key: keyof Flags; icon: typeof Wallet; title: string; desc: string }[] = [
    {
      key: "financeSpaceEnabled",
      icon: Wallet,
      title: "Activer l'espace Finances",
      desc: "Affiche ou masque l'espace Finances (menus, raccourcis, accès aux pages). Les données financières existantes sont conservées.",
    },
    {
      key: "autoBudgetClassificationEnabled",
      icon: PiggyBank,
      title: "Classer automatiquement les documents dans le budget",
      desc: "Quand cette option est activée, GEDify rattache automatiquement les documents importés à une catégorie budgétaire. L'OCR, les tags, les types et l'analyse IA continuent dans tous les cas.",
    },
  ];

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border px-3 py-2 text-[12.5px]" style={{ borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }}>
          {error}
        </p>
      ) : null}
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div
            key={row.key}
            className="flex items-start gap-3 rounded-xl border p-4"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(11,92,255,0.08)", color: "#0B5CFF" }}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>{row.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{row.desc}</p>
            </div>
            <div className="flex h-9 items-center">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
              ) : saving === row.key ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#0B5CFF" }} aria-hidden="true" />
              ) : (
                <Toggle checked={flags[row.key]} onChange={(v) => void update(row.key, v)} label={row.title} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
