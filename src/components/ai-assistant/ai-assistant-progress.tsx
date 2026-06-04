"use client";

import { Loader2 } from "lucide-react";

/** Progression d'une action en cours (barre indéterminée + libellé). */
export function AiAssistantProgress({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--gedify-navy)" }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {label}
      </p>
      {detail ? <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>{detail}</p> : null}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-full w-1/3 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
      </div>
    </div>
  );
}
