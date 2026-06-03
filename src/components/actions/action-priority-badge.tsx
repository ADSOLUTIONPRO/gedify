import { ACTION_PRIORITY_LABELS, type ActionPriority } from "@/lib/actions/types";

const TONE: Record<ActionPriority, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-500",
  normal: "border-slate-200 bg-white text-slate-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  urgent: "border-rose-200 bg-rose-50 text-rose-700",
};

export function ActionPriorityBadge({ priority }: { priority: ActionPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE[priority]}`}
    >
      {ACTION_PRIORITY_LABELS[priority]}
    </span>
  );
}
