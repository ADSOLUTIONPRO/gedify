import "server-only";

import { listGedWorkflows } from "@/lib/ged/ged-store";
import { listAudit } from "@/lib/audit/audit-store";

/* ────────────────────────────────────────────────────────────────────────
   Rapport AUTOMATISATIONS & ACTIONS (Partie 6) pour la Santé GED. LECTURE
   SEULE. Agrège l'état des workflows/règles + les dernières actions groupées
   et exécutions journalisées (audit log). Surface le journal des actions de
   masse ajouté côté routes bulk.
   ──────────────────────────────────────────────────────────────────────── */

export type AutomationActionEntry = {
  at: string;
  user: string;
  action: string;
  target: string | null;
  result: "success" | "denied" | "error";
  details: string | null;
};

export type AutomationReport = {
  workflows: { total: number; enabled: number; neverRun: number; lastRunAt: string | null };
  recentActions: AutomationActionEntry[];
  generatedAt: string;
};

/** Préfixes d'actions « automatisation / actions groupées » dans l'audit. */
const ACTION_PREFIXES = ["workflow.", "documents.bulk", "documents.trash.bulk", "budget.bulk", "ai.analyses.bulk", "taxonomy.merge", "pipeline."];

export async function computeAutomationReport(): Promise<AutomationReport> {
  const workflows = await listGedWorkflows();
  const enabled = workflows.filter((w) => w.enabled).length;
  const neverRun = workflows.filter((w) => !w.lastRunAt).length;
  const lastRunAt = workflows
    .map((w) => w.lastRunAt)
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  const audit = await listAudit(200);
  const recentActions = audit
    .filter((e) => ACTION_PREFIXES.some((p) => e.action.startsWith(p)))
    .slice(0, 10)
    .map((e) => ({ at: e.at, user: e.user, action: e.action, target: e.target, result: e.result, details: e.details }));

  return {
    workflows: { total: workflows.length, enabled, neverRun, lastRunAt },
    recentActions,
    generatedAt: new Date().toISOString(),
  };
}
