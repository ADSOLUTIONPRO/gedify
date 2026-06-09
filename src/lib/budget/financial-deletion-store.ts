import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getBudgetDataDir } from "./storage";

/**
 * « Tombstones » de données financières supprimées manuellement.
 *
 * Problème résolu : une ligne budget supprimée par l'utilisateur (Fiche Doc,
 * espace Finances) était silencieusement recréée par l'analyse IA, ou
 * ré-affichée comme « montant détecté » à la réouverture de la Fiche Doc.
 *
 * Ce store enregistre, par document, la PROVENANCE `manual_delete` :
 *  - scope "amount"   → un montant détecté précis a été supprimé ;
 *  - scope "document" → le document a été retiré du budget (toutes ses lignes).
 *
 * Conséquences :
 *  - l'IA ne recrée plus automatiquement une ligne supprimée
 *    (voir auto-create-financial-items) ;
 *  - la répartition de la Fiche Doc filtre les montants supprimés ;
 *  - seule une action EXPLICITE de l'utilisateur (créer la ligne au budget)
 *    lève le tombstone (« restaurer volontairement »).
 *
 * Compatible Postgres (JSONB) et SQLite via le routage central `pg-store`.
 */

const FILE = "financial-deletions.json";
const TABLE = "financial_deletions";

export type FinancialDeletion = {
  id: string;
  documentId: number;
  /** "amount" = un montant détecté précis ; "document" = retrait total du budget. */
  scope: "amount" | "document";
  kind?: string | null;
  /** Montant supprimé (arrondi au centime), pour la mise en correspondance. */
  amount?: number | null;
  label?: string | null;
  deletedAt: string;
  deletedBy?: string | null;
};

function filePath() {
  return path.join(getBudgetDataDir(), FILE);
}

async function readAllJson(): Promise<FinancialDeletion[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FinancialDeletion[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<FinancialDeletion[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<FinancialDeletion>(TABLE);
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: FinancialDeletion[]) {
  if (pgStorageActive()) {
    await pgWriteAll<FinancialDeletion>(TABLE, "id", (i) => i.id, items);
    return;
  }
  await mkdir(getBudgetDataDir(), { recursive: true });
  await writeFile(filePath(), JSON.stringify(items, null, 2), "utf8");
}

/** Montant normalisé au centime (clé de comparaison robuste). */
function cents(amount: number | null | undefined): number | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export async function listDeletions(documentId?: number): Promise<FinancialDeletion[]> {
  const all = await readAll();
  return documentId == null ? all : all.filter((d) => d.documentId === documentId);
}

/**
 * Enregistre une suppression manuelle. Idempotent par (document, scope, montant) :
 * ne crée pas de doublon si le même tombstone existe déjà.
 */
export async function recordDeletion(input: {
  documentId: number;
  scope: "amount" | "document";
  kind?: string | null;
  amount?: number | null;
  label?: string | null;
  deletedBy?: string | null;
}): Promise<FinancialDeletion> {
  const all = await readAll();
  const targetCents = cents(input.amount);
  const existing = all.find(
    (d) =>
      d.documentId === input.documentId &&
      d.scope === input.scope &&
      (input.scope === "document" || cents(d.amount) === targetCents),
  );
  if (existing) return existing;
  const entry: FinancialDeletion = {
    id: randomUUID(),
    documentId: input.documentId,
    scope: input.scope,
    kind: input.kind ?? null,
    amount: input.amount ?? null,
    label: input.label ?? null,
    deletedAt: new Date().toISOString(),
    deletedBy: input.deletedBy ?? null,
  };
  all.push(entry);
  await writeAll(all);
  return entry;
}

/**
 * Lève les tombstones d'un document (« restaurer volontairement »).
 * - sans `amount` → efface aussi le tombstone "document" (retrait du budget) ;
 * - avec `amount` → efface seulement les tombstones de ce montant + le tombstone
 *   "document" (l'ajout explicite d'une ligne ré-inclut le document au budget).
 * Retourne le nombre de tombstones levés.
 */
export async function clearDeletions(
  documentId: number,
  opts: { amount?: number | null } = {},
): Promise<number> {
  const all = await readAll();
  const targetCents = cents(opts.amount);
  const next = all.filter((d) => {
    if (d.documentId !== documentId) return true;
    if (d.scope === "document") return false; // toute création explicite ré-inclut le doc
    if (targetCents == null) return false; // pas de montant ciblé → on lève tout pour ce doc
    return cents(d.amount) !== targetCents;
  });
  const removed = all.length - next.length;
  if (removed > 0) await writeAll(next);
  return removed;
}

/** Le document a-t-il été entièrement retiré du budget manuellement ? */
export async function isDocumentTombstoned(documentId: number): Promise<boolean> {
  const list = await listDeletions(documentId);
  return list.some((d) => d.scope === "document");
}

/** Ce montant (±0,01) a-t-il été supprimé manuellement pour ce document ? */
export async function isAmountTombstoned(
  documentId: number,
  amount: number,
  _kind?: string | null,
): Promise<boolean> {
  const list = await listDeletions(documentId);
  if (list.some((d) => d.scope === "document")) return true;
  const target = cents(amount);
  return list.some((d) => d.scope === "amount" && cents(d.amount) === target);
}
