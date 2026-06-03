import { ActionCard } from "@/components/actions/action-card";
import { ACTION_STATUS_LABELS, type ActionItem, type ActionStatus } from "@/lib/actions/types";

const COLUMNS: ActionStatus[] = ["todo", "in-progress", "waiting", "done"];

const COLUMN_COLOR: Record<string, string> = {
  todo: "#0B5CFF",
  "in-progress": "#16A34A",
  waiting: "#F59E0B",
  done: "#94A3B8",
};

/** Vue Kanban des actions (colonnes À faire / En cours / En attente / Terminées). */
export function ActionsBoard({ actions }: { actions: ActionItem[] }) {
  // Les actions en retard restent dans leur colonne logique (todo) — le statut
  // overdue est dérivé de la date ; on les regroupe avec "À faire".
  const byColumn = (col: ActionStatus) =>
    actions.filter((a) => (col === "todo" ? a.status === "todo" || a.status === "overdue" : a.status === col));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = byColumn(col);
        return (
          <div key={col} className="rounded-2xl border p-2.5" style={{ borderColor: "var(--border)", background: "rgba(248,250,252,0.6)" }}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: COLUMN_COLOR[col] }} />
              <span className="text-[12px] font-bold" style={{ color: "var(--text-main)" }}>{ACTION_STATUS_LABELS[col]}</span>
              <span className="ml-auto rounded-md px-1.5 text-[11px] font-bold" style={{ background: `${COLUMN_COLOR[col]}14`, color: COLUMN_COLOR[col] }}>{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="px-1 py-3 text-center text-[11.5px]" style={{ color: "var(--text-muted)" }}>—</p>
              ) : (
                items.map((a) => <ActionCard key={a.id} action={a} compact />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
