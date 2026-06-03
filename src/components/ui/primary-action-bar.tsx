import type { ReactNode } from "react";

type PrimaryActionBarProps = {
  children: ReactNode;
  className?: string;
};

export function PrimaryActionBar({ children, className = "" }: PrimaryActionBarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 shadow-sm backdrop-blur ${className}`}
      style={{ border: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}
