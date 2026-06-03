import { ACTION_STATUS_LABELS, type ActionStatus } from "@/lib/actions/types";

const TONE: Record<ActionStatus, string> = {
  todo: "border-blue-200 bg-blue-50 text-blue-700",
  "in-progress": "border-violet-200 bg-violet-50 text-violet-700",
  waiting: "border-amber-200 bg-amber-50 text-amber-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-slate-200 bg-slate-100 text-slate-500",
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
};

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE[status]}`}
    >
      {ACTION_STATUS_LABELS[status]}
    </span>
  );
}
