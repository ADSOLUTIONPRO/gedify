"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RowAction = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "danger" | "warning";
  disabled?: boolean;
};

type Props = {
  actions: RowAction[];
  label?: string;
  align?: "left" | "right";
};

export function RowActionsMenu({ actions, label, align = "right" }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label ?? "Actions"}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100"
        style={{ color: "var(--text-muted)" }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open ? (
        <div
          role="menu"
          className={`absolute z-30 mt-1 min-w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}
        >
          {actions.map((action, i) => {
            const Icon = action.icon;
            const color =
              action.variant === "danger"
                ? "#DC2626"
                : action.variant === "warning"
                  ? "#D97706"
                  : "var(--text-main)";

            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition hover:bg-slate-50 disabled:opacity-40"
                style={{ color }}
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> : null}
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
