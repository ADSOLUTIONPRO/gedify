/**
 * Script de reset complet de l'historique interne GED AzServer.
 * Usage : npm run reset:ged-history
 *
 * Supprime :
 *   - analyses IA (data/ai/analyses.json)
 *   - infos détectées (data/ai/detected-infos.json)
 *   - mémoire de corrections IA (data/ai/correction-memory.json)
 *   - brouillons budget non validés (data/budget/financial-items.json)
 *   - actions IA non terminées + rappels associés (data/actions/)
 *
 * NE supprime jamais :
 *   - les documents Paperless
 *   - les fichiers PDF
 *   - les tags / correspondants / types Paperless
 *   - les utilisateurs
 *   - les paramètres / tokens / variables d'environnement
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// ---------------------------------------------------------------------------
// Config (identiques aux stores Next.js)
// ---------------------------------------------------------------------------

const AI_DIR = process.env.AI_STORAGE_PATH ?? path.join(process.cwd(), "data", "ai");
const BUDGET_DIR =
  process.env.BUDGET_STORAGE_PATH ?? path.join(process.cwd(), "data", "budget");
const ACTIONS_DIR =
  process.env.ACTIONS_STORAGE_PATH ?? path.join(process.cwd(), "data", "actions");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonArray<T>(filePath: string, data: T[]): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Analyse de ce qui sera supprimé (dry-run)
// ---------------------------------------------------------------------------

async function audit() {
  const aiAnalyses = await readJsonArray(path.join(AI_DIR, "analyses.json"));
  const detectedInfos = await readJsonArray(path.join(AI_DIR, "detected-infos.json"));
  const correctionMemory = await readJsonArray(path.join(AI_DIR, "correction-memory.json"));

  type FinancialItem = {
    validationStatus?: string;
    status?: string;
  };
  const allFinancials = await readJsonArray<FinancialItem>(
    path.join(BUDGET_DIR, "financial-items.json"),
  );
  const budgetDrafts = allFinancials.filter((item) => {
    const isValidated =
      item.validationStatus === "validated" ||
      item.status === "paid" ||
      item.status === "partially_paid";
    return !isValidated;
  });

  type ActionItem = { createdFrom?: string; status?: string };
  const allActions = await readJsonArray<ActionItem>(path.join(ACTIONS_DIR, "actions.json"));
  const aiActions = allActions.filter(
    (item) =>
      item.createdFrom === "ai" &&
      item.status !== "done" &&
      item.status !== "cancelled",
  );

  type ReminderItem = { actionId?: string | null; status?: string };
  const allReminders = await readJsonArray<ReminderItem>(
    path.join(ACTIONS_DIR, "reminders.json"),
  );

  return {
    aiAnalyses: aiAnalyses.length,
    detectedInfos: detectedInfos.length,
    correctionMemory: correctionMemory.length,
    budgetDrafts: budgetDrafts.length,
    aiActionsAndReminders: aiActions.length + allReminders.length,
    budgetValidated: allFinancials.length - budgetDrafts.length,
    actionsManual: allActions.length - aiActions.length,
    remindersTotal: allReminders.length,
  };
}

// ---------------------------------------------------------------------------
// Reset effectif
// ---------------------------------------------------------------------------

async function runReset() {
  const report = { aiAnalyses: 0, detectedInfos: 0, correctionMemory: 0, budgetDrafts: 0, actionDrafts: 0 };

  // analyses.json → vider entièrement
  {
    const all = await readJsonArray(path.join(AI_DIR, "analyses.json"));
    report.aiAnalyses = all.length;
    await writeJsonArray(path.join(AI_DIR, "analyses.json"), []);
  }

  // detected-infos.json → vider entièrement
  {
    const all = await readJsonArray(path.join(AI_DIR, "detected-infos.json"));
    report.detectedInfos = all.length;
    await writeJsonArray(path.join(AI_DIR, "detected-infos.json"), []);
  }

  // correction-memory.json → vider entièrement
  {
    const all = await readJsonArray(path.join(AI_DIR, "correction-memory.json"));
    report.correctionMemory = all.length;
    await writeJsonArray(path.join(AI_DIR, "correction-memory.json"), []);
  }

  // financial-items.json → conserver validés seulement
  {
    type Item = { validationStatus?: string; status?: string };
    const all = await readJsonArray<Item>(path.join(BUDGET_DIR, "financial-items.json"));
    const kept = all.filter(
      (item) =>
        item.validationStatus === "validated" ||
        item.status === "paid" ||
        item.status === "partially_paid",
    );
    report.budgetDrafts = all.length - kept.length;
    if (report.budgetDrafts > 0) {
      await writeJsonArray(path.join(BUDGET_DIR, "financial-items.json"), kept);
    }
  }

  // actions.json → conserver actions manuelles + terminées
  {
    type ActionItem = { id: string; createdFrom?: string; status?: string };
    const all = await readJsonArray<ActionItem>(path.join(ACTIONS_DIR, "actions.json"));
    const removedIds = new Set(
      all
        .filter(
          (item) =>
            item.createdFrom === "ai" &&
            item.status !== "done" &&
            item.status !== "cancelled",
        )
        .map((item) => item.id),
    );
    const kept = all.filter((item) => !removedIds.has(item.id));
    const deletedActions = all.length - kept.length;
    if (deletedActions > 0) await writeJsonArray(path.join(ACTIONS_DIR, "actions.json"), kept);

    // reminders.json → conserver ceux non liés aux actions supprimées
    type ReminderItem = { actionId?: string | null; status?: string };
    const allReminders = await readJsonArray<ReminderItem>(
      path.join(ACTIONS_DIR, "reminders.json"),
    );
    const keptReminders = allReminders.filter(
      (r) => !r.actionId || !removedIds.has(r.actionId) || r.status === "done",
    );
    const deletedReminders = allReminders.length - keptReminders.length;
    if (deletedReminders > 0) {
      await writeJsonArray(path.join(ACTIONS_DIR, "reminders.json"), keptReminders);
    }

    report.actionDrafts = deletedActions + deletedReminders;
  }

  return report;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n========================================");
  console.log("  GED AzServer — Reset historique interne");
  console.log("========================================\n");

  console.log("Analyse des données en place…\n");
  const summary = await audit();

  console.log("CE QUI SERA SUPPRIMÉ :");
  console.log(`  Analyses IA            : ${summary.aiAnalyses}`);
  console.log(`  Infos détectées        : ${summary.detectedInfos}`);
  console.log(`  Mémoire corrections    : ${summary.correctionMemory}`);
  console.log(`  Brouillons budget IA   : ${summary.budgetDrafts}`);
  console.log(`  Actions/rappels IA     : ${summary.aiActionsAndReminders}`);

  console.log("\nCE QUI SERA CONSERVÉ :");
  console.log(`  Lignes budget validées : ${summary.budgetValidated}`);
  console.log(`  Actions manuelles      : ${summary.actionsManual}`);
  console.log("  Documents Paperless    : tous");
  console.log("  Tags / correspondants  : tous");
  console.log("  Paramètres / tokens    : tous");
  console.log("  Utilisateurs           : tous\n");

  const forceMode = process.argv.includes("--force") || process.argv.includes("-y");

  if (!forceMode) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(
      'Tapez "RESET_GED_HISTORY" pour confirmer ou Ctrl+C pour annuler : ',
    );
    rl.close();

    if (answer.trim() !== "RESET_GED_HISTORY") {
      console.log("\nAnnulé — aucune donnée supprimée.\n");
      process.exit(0);
    }
  }

  console.log("\nSuppression en cours…");
  const result = await runReset();

  const total =
    result.aiAnalyses +
    result.detectedInfos +
    result.correctionMemory +
    result.budgetDrafts +
    result.actionDrafts;

  console.log("\nRésultat :");
  console.log(`  Analyses IA            : ${result.aiAnalyses}`);
  console.log(`  Infos détectées        : ${result.detectedInfos}`);
  console.log(`  Mémoire corrections    : ${result.correctionMemory}`);
  console.log(`  Brouillons budget      : ${result.budgetDrafts}`);
  console.log(`  Actions / rappels IA   : ${result.actionDrafts}`);
  console.log(`\n✓ Total supprimé : ${total} entrée(s).`);
  console.log("  Documents Paperless conservés.\n");
}

main().catch((err: unknown) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
