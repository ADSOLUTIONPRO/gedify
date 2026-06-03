/**
 * Script de nettoyage des données IA orphelines.
 * Usage : npm run cleanup:orphan-ai
 *
 * Compare les IDs stockés localement avec les documents Paperless existants.
 * Supprime les données IA non validées qui ne correspondent plus à aucun document.
 * NE supprime jamais de documents Paperless.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config (mêmes chemins que les stores Next.js)
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.AI_DATA_DIR ?? path.join(process.cwd(), "data", "ai");
const BUDGET_DIR = process.env.BUDGET_DATA_DIR ?? path.join(process.cwd(), "data", "budget");

async function readJsonFile<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonFile<T>(filePath: string, data: T[]): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Fetch Paperless document IDs
// ---------------------------------------------------------------------------

async function fetchPaperlessIds(): Promise<Set<number>> {
  const baseUrl = process.env.PAPERLESS_BASE_URL ?? "http://localhost:8000";
  const token = process.env.PAPERLESS_TOKEN;
  if (!token) {
    console.error("❌  PAPERLESS_TOKEN non défini.");
    process.exit(1);
  }

  const ids = new Set<number>();
  let url: string | null = `${baseUrl}/api/documents/?page_size=100&fields=id`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) {
      console.error(`❌  Paperless a répondu HTTP ${res.status}`);
      process.exit(1);
    }
    const data = (await res.json()) as {
      count: number;
      next: string | null;
      results: { id: number }[];
    };
    for (const doc of data.results) ids.add(Number(doc.id));
    url = data.next ?? null;
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("📋  Récupération des IDs Paperless…");
  const existingIds = await fetchPaperlessIds();
  console.log(`   ${existingIds.size} documents trouvés dans Paperless.\n`);

  const report = {
    detectedInfos: 0,
    aiAnalyses: 0,
    financialItems: 0,
    actions: 0,
    reminders: 0,
  };

  // 1. detected-infos.json
  {
    const file = path.join(DATA_DIR, "detected-infos.json");
    type Item = { id: string; sourceDocumentId: number | null };
    const all = await readJsonFile<Item>(file);
    const kept = all.filter((item) => {
      if (item.sourceDocumentId == null) return true;
      if (existingIds.has(item.sourceDocumentId)) return true;
      report.detectedInfos++;
      return false;
    });
    if (report.detectedInfos > 0) await writeJsonFile(file, kept);
  }

  // 2. analyses.json
  {
    const file = path.join(DATA_DIR, "analyses.json");
    type Item = { id: string; documentId: number };
    const all = await readJsonFile<Item>(file);
    const kept = all.filter((item) => {
      if (!item.documentId) return true;
      if (existingIds.has(item.documentId)) return true;
      report.aiAnalyses++;
      return false;
    });
    if (report.aiAnalyses > 0) await writeJsonFile(file, kept);
  }

  // 3. financial-items.json (only non-validated)
  {
    const file = path.join(BUDGET_DIR, "financial-items.json");
    type Item = {
      id: string;
      sourceDocumentId: number | null;
      validationStatus: string;
      status: string;
    };
    const all = await readJsonFile<Item>(file);
    const kept = all.filter((item) => {
      if (item.sourceDocumentId == null) return true;
      if (existingIds.has(item.sourceDocumentId)) return true;
      const isValidated =
        item.validationStatus === "validated" ||
        item.status === "paid" ||
        item.status === "partially_paid";
      if (isValidated) return true; // keep validated items even if orphan
      report.financialItems++;
      return false;
    });
    if (report.financialItems > 0) await writeJsonFile(file, kept);
  }

  // 4. actions.json (only AI-generated, non-done)
  {
    const file = path.join(DATA_DIR, "actions.json");
    type Item = { id: string; documentIds: number[]; createdFrom: string; status: string };
    const all = await readJsonFile<Item>(file);
    const kept = all.filter((item) => {
      if (item.documentIds.length === 0) return true;
      const allGone = item.documentIds.every((id) => !existingIds.has(id));
      if (!allGone) return true;
      if (item.createdFrom !== "ai" || item.status === "done") return true;
      report.actions++;
      return false;
    });
    if (report.actions > 0) await writeJsonFile(file, kept);
  }

  // 5. reminders.json (only non-done)
  {
    const file = path.join(DATA_DIR, "reminders.json");
    type Item = { id: string; documentId: number | null; status: string };
    const all = await readJsonFile<Item>(file);
    const kept = all.filter((item) => {
      if (item.documentId == null) return true;
      if (existingIds.has(item.documentId)) return true;
      if (item.status !== "scheduled") return true;
      report.reminders++;
      return false;
    });
    if (report.reminders > 0) await writeJsonFile(file, kept);
  }

  const total = Object.values(report).reduce((s, n) => s + n, 0);

  console.log("📊  Rapport :");
  console.log(`   Infos détectées supprimées : ${report.detectedInfos}`);
  console.log(`   Analyses IA supprimées     : ${report.aiAnalyses}`);
  console.log(`   Lignes budget supprimées   : ${report.financialItems}`);
  console.log(`   Actions supprimées         : ${report.actions}`);
  console.log(`   Rappels supprimés          : ${report.reminders}`);
  console.log(`\n✅  Total : ${total} entrée(s) orpheline(s) supprimée(s).`);
}

main().catch((err: unknown) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
