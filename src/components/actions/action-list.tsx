import { ListChecks } from "lucide-react";
import { ActionCard } from "@/components/actions/action-card";
import type { ActionItem } from "@/lib/actions/types";

type ActionListProps = {
  actions: ActionItem[];
  emptyTitle?: string;
  emptyDescription?: string;
};

/** Liste verticale d'actions (pages filtrées). */
export function ActionList({ actions, emptyTitle = "Aucune action", emptyDescription = "Rien dans cette vue." }: ActionListProps) {
  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
        <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(22,163,74,0.08)", color: "#16A34A" }}>
          <ListChecks className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <p className="mt-3 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{emptyTitle}</p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>{emptyDescription}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {actions.map((a) => (
        <ActionCard key={a.id} action={a} />
      ))}
    </div>
  );
}
