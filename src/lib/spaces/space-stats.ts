import "server-only";

import { listActions } from "@/lib/actions/action-store";
import { listReminders } from "@/lib/actions/reminder-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { paperlessFetch } from "@/lib/paperless";
import type { PaperlessStatistics } from "@/lib/paperless-types";
import type { SpaceStat } from "@/config/spaces";

/** Carte spaceId → stats affichables (données réelles ou 0). */
export type LiveStatsMap = Record<string, SpaceStat[]>;

export async function getRealStats(): Promise<LiveStatsMap> {
  const [paperlessRes, actionsRes, remindersRes, itemsRes, analysesRes] = await Promise.allSettled([
    paperlessFetch<PaperlessStatistics>("/api/statistics/"),
    listActions(),
    listReminders(),
    listFinancialItems(),
    listAnalyses(),
  ]);

  // Documents (Paperless)
  const pStats = paperlessRes.status === "fulfilled" ? paperlessRes.value : null;
  const docTotal = pStats?.documents_total ?? 0;
  const docInbox = pStats?.documents_inbox ?? 0;

  // Analyse IA
  const analyses = analysesRes.status === "fulfilled" ? analysesRes.value : [];
  const iaToValidate = analyses.filter((a) => a.status === "ready-to-validate").length;
  const iaValidated = analyses.filter((a) => a.status === "validated" || a.status === "applied").length;

  // Finances
  const items = itemsRes.status === "fulfilled" ? itemsRes.value : [];
  const finOverdue = items.filter((i) => i.paymentStatus === "overdue").length;
  const finDueSoon = items.filter((i) => i.paymentStatus === "due_soon" || i.paymentStatus === "due").length;

  // Actions
  const actions = actionsRes.status === "fulfilled" ? actionsRes.value : [];
  const actionTodo = actions.filter((a) => a.status === "todo").length;
  const actionInProgress = actions.filter((a) => a.status === "in-progress").length;

  // Rappels
  const reminders = remindersRes.status === "fulfilled" ? remindersRes.value : [];
  const now = Date.now();
  const remUpcoming = reminders.filter(
    (r) => r.status === "scheduled" && new Date(r.remindAt).getTime() > now,
  ).length;
  const remOverdue = reminders.filter(
    (r) => r.status === "scheduled" && new Date(r.remindAt).getTime() <= now,
  ).length;

  // Organiser
  const tagCount = pStats?.tag_count ?? 0;
  const correspondentCount = pStats?.correspondent_count ?? 0;

  return {
    documents: [
      { label: "Documents", value: docTotal },
      { label: "Non classés", value: docInbox },
    ],
    ia: [
      { label: "À valider", value: iaToValidate },
      { label: "Validés", value: iaValidated },
    ],
    finances: [
      { label: "En retard", value: finOverdue },
      { label: "À venir", value: finDueSoon },
    ],
    actions: [
      { label: "À faire", value: actionTodo },
      { label: "En cours", value: actionInProgress },
    ],
    rappels: [
      { label: "À venir", value: remUpcoming },
      { label: "En retard", value: remOverdue },
    ],
    organiser: [
      { label: "Tags", value: tagCount },
      { label: "Correspondants", value: correspondentCount },
    ],
  };
}
