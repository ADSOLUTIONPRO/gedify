import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

export function AdminMenu() {
  return (
    <Link
      href="/administration"
      className="inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition hover:bg-slate-50"
      style={{ borderColor: "var(--border)", color: "var(--text-main)", background: "white" }}
      title="Centre d'administration"
    >
      <SlidersHorizontal className="h-4 w-4 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden sm:inline">Administration</span>
    </Link>
  );
}
