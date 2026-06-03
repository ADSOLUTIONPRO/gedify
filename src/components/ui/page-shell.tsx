import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <main className={`p-5 lg:p-6 space-y-5 ${className}`}>{children}</main>
  );
}
