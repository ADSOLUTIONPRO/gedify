"use client";

import type { QuickSuggestion } from "@/lib/assistant/assistant-types";

/** Chips de suggestions rapides : envoient un prompt interne au chat. */
export function AiAssistantSuggestions({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions: QuickSuggestion[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s.prompt)}
          className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition hover:bg-[var(--bg-card-soft)] disabled:opacity-50"
          style={{ borderColor: "var(--border-strong)", color: "var(--gedify-navy)" }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
