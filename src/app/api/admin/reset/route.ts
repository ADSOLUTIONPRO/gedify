import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getAiDataDir, getBudgetDataDir, getActionsDataDir } from "@/lib/budget/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResetScope = "ai" | "finances" | "actions" | "suggestions" | "all-internal";

const CONFIRM_CODES: Record<ResetScope, string> = {
  ai: "RESET",
  finances: "RESET",
  actions: "RESET",
  suggestions: "RESET",
  "all-internal": "RESET_GED_INTERNAL_DATA",
};

// ---------------------------------------------------------------------------
// Helpers JSON
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
// Reset helpers
// ---------------------------------------------------------------------------

async function resetAi() {
  const aiDir = getAiDataDir();
  const analysesFile = path.join(aiDir, "analyses.json");
  const infosFile = path.join(aiDir, "detected-infos.json");
  const memoryFile = path.join(aiDir, "correction-memory.json");
  const [a, d, m] = await Promise.all([
    readJsonArray(analysesFile),
    readJsonArray(infosFile),
    readJsonArray(memoryFile),
  ]);
  await Promise.all([
    writeJsonArray(analysesFile, []),
    writeJsonArray(infosFile, []),
    writeJsonArray(memoryFile, []),
  ]);
  return { aiAnalyses: a.length, detectedInfos: d.length, correctionMemory: m.length };
}

async function resetFinances() {
  const file = path.join(getBudgetDataDir(), "financial-items.json");
  type Item = { validationStatus?: string; status?: string };
  const all = await readJsonArray<Item>(file);
  const kept = all.filter(
    (item) =>
      item.validationStatus === "validated" ||
      item.status === "paid" ||
      item.status === "partially_paid",
  );
  const deleted = all.length - kept.length;
  if (deleted > 0) await writeJsonArray(file, kept);
  return { financialDrafts: deleted };
}

async function resetActions() {
  const actionsFile = path.join(getActionsDataDir(), "actions.json");
  const remindersFile = path.join(getActionsDataDir(), "reminders.json");
  type ActionItem = { id: string; createdFrom?: string; status?: string };
  const allActions = await readJsonArray<ActionItem>(actionsFile);
  const removedIds = new Set(
    allActions
      .filter((a) => a.createdFrom === "ai" && a.status !== "done" && a.status !== "cancelled")
      .map((a) => a.id),
  );
  const keptActions = allActions.filter((a) => !removedIds.has(a.id));
  const deletedActions = allActions.length - keptActions.length;
  if (deletedActions > 0) await writeJsonArray(actionsFile, keptActions);

  type ReminderItem = { actionId?: string | null; status?: string };
  const allReminders = await readJsonArray<ReminderItem>(remindersFile);
  const keptReminders = allReminders.filter(
    (r) => !r.actionId || !removedIds.has(r.actionId) || r.status === "done",
  );
  const deletedReminders = allReminders.length - keptReminders.length;
  if (deletedReminders > 0) await writeJsonArray(remindersFile, keptReminders);

  return { actionDrafts: deletedActions, reminderDrafts: deletedReminders };
}

// For "suggestions" scope: same as AI analyses + detected infos (no correction memory)
async function resetSuggestions() {
  const aiDir = getAiDataDir();
  const analysesFile = path.join(aiDir, "analyses.json");
  const infosFile = path.join(aiDir, "detected-infos.json");
  const [a, d] = await Promise.all([readJsonArray(analysesFile), readJsonArray(infosFile)]);
  await Promise.all([writeJsonArray(analysesFile, []), writeJsonArray(infosFile, [])]);
  return { aiAnalyses: a.length, detectedInfos: d.length };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  const g = await (await import("@/lib/saas/admin-guards")).denyGlobalAdminForTenant("reset"); if (g) return g;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const scope = body.scope as ResetScope | undefined;
  const validScopes: ResetScope[] = ["ai", "finances", "actions", "suggestions", "all-internal"];
  if (!scope || !validScopes.includes(scope)) {
    return NextResponse.json(
      { error: `scope invalide. Valeurs acceptées : ${validScopes.join(", ")}.` },
      { status: 400 },
    );
  }

  const expectedConfirm = CONFIRM_CODES[scope];
  if (body.confirm !== expectedConfirm) {
    return NextResponse.json(
      { error: `Confirmation incorrecte. Envoyez { "confirm": "${expectedConfirm}" }.` },
      { status: 400 },
    );
  }

  try {
    let deleted: Record<string, number> = {};

    switch (scope) {
      case "ai":
        deleted = await resetAi();
        break;
      case "finances":
        deleted = await resetFinances();
        break;
      case "actions":
        deleted = await resetActions();
        break;
      case "suggestions":
        deleted = await resetSuggestions();
        break;
      case "all-internal": {
        const [ai, fin, act] = await Promise.all([resetAi(), resetFinances(), resetActions()]);
        deleted = { ...ai, ...fin, ...act };
        break;
      }
    }

    return NextResponse.json({
      ok: true,
      scope,
      deleted,
      preserved: {
        paperlessDocuments: true,
        paperlessFiles: true,
        paperlessTaxonomies: true,
        users: true,
        settings: true,
      },
    });
  } catch (error) {
    return jsonError("Erreur lors de la réinitialisation", error);
  }
}
