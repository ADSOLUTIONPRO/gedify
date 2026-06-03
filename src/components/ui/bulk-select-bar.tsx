"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

type BulkSelectBarProps = {
  count: number;
  onClear: () => void;
  actions?: ReactNode;
};

/**
 * Sticky action bar shown when items are selected in a list.
 * Pair with `useBulkSelect` for selection state management.
 */
export function BulkSelectBar({ count, onClear, actions }: BulkSelectBarProps) {
  if (count === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2.5"
      style={{ borderColor: "var(--blue-600)", boxShadow: "0 1px 2px rgba(11,92,255,0.10)" }}
    >
      <span
        className="inline-flex items-center gap-2 pl-1 pr-1 text-[12.5px] font-bold"
        style={{ color: "var(--blue-600)" }}
      >
        {count} sélectionné{count > 1 ? "s" : ""}
        <button
          type="button"
          onClick={onClear}
          aria-label="Tout désélectionner"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </span>

      {actions ? (
        <>
          <span className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} aria-hidden="true" />
          {actions}
        </>
      ) : null}
    </div>
  );
}

type SelectAllCheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label?: string;
};

/**
 * "Select all" checkbox for list headers.
 */
export function SelectAllCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label = "Tout sélectionner",
}: SelectAllCheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
      />
      {label}
    </label>
  );
}

type RowCheckboxProps = {
  checked: boolean;
  onChange: () => void;
  label?: string;
};

/**
 * Single row checkbox for list items.
 */
export function RowCheckbox({ checked, onChange, label }: RowCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label ?? "Sélectionner"}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
      onClick={(e) => e.stopPropagation()}
    />
  );
}
