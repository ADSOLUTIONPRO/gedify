import Link from "next/link";
import { FileText, FolderTree, Users, Wallet } from "lucide-react";
import type { ActionItem } from "@/lib/actions/types";

/** Éléments GED liés à une action (documents, budget, correspondant, dossier). */
export function ActionLinkedItems({ action }: { action: ActionItem }) {
  const rows: { icon: typeof FileText; label: string; href: string }[] = [];
  for (const docId of action.documentIds) rows.push({ icon: FileText, label: `Document #${docId}`, href: `/documents/${docId}` });
  if (action.budgetItemId) rows.push({ icon: Wallet, label: "Élément financier lié", href: "/finances" });
  if (action.projectId) rows.push({ icon: FolderTree, label: "Dossier / projet lié", href: `/dossiers/${action.projectId}` });
  if (action.correspondentId) rows.push({ icon: Users, label: "Correspondant lié", href: `/documents?correspondent=${action.correspondentId}` });

  if (rows.length === 0) {
    return <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucun élément lié.</p>;
  }

  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <Link key={r.href + r.label} href={r.href} className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12.5px] font-medium transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{r.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
