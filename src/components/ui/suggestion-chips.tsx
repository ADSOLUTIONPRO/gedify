"use client";

import { Plus } from "lucide-react";

type SuggestionChipsProps = {
  suggestions: string[];
  onPick: (value: string) => void;
  label?: string;
  className?: string;
  emptyState?: "muted";
};

export function SuggestionChips({
  suggestions,
  onPick,
  label = "Suggestions",
  className = "",
  emptyState,
}: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={className}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              emptyState === "muted"
                ? "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                : "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100"
            }`}
          >
            <Plus className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
