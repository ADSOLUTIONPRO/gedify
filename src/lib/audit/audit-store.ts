import "server-only";

import { randomUUID } from "node:crypto";
import { readStore, writeStore } from "@/lib/engine/stores";
import { getCurrentUser } from "@/lib/auth/current-user";

/* ────────────────────────────────────────────────────────────────────────
   Journal d'audit (Chantier permissions) : qui a fait quoi, quand.

   Append-only, plafonné aux N dernières entrées. Persisté via le store moteur
   clé/valeur « audit-log » (table settings en postgres → inclus dans le backup,
   JSON sinon). N'échoue jamais (best-effort) pour ne pas bloquer une action.
   ──────────────────────────────────────────────────────────────────────── */

const STORE_KEY = "audit-log";
const MAX_ENTRIES = 3000;

export type AuditEntry = {
  id: string;
  at: string;
  user: string;
  action: string;
  target: string | null;
  result: "success" | "denied" | "error";
  details: string | null;
};

export type AuditInput = {
  action: string;
  target?: string | null;
  result?: AuditEntry["result"];
  details?: string | null;
  /** Auteur explicite ; sinon résolu depuis la session. */
  user?: string;
};

async function readAll(): Promise<AuditEntry[]> {
  const v = await readStore<AuditEntry[]>(STORE_KEY, []);
  return Array.isArray(v) ? v : [];
}

/** Enregistre une entrée d'audit (best-effort, ne lève jamais). */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    let user = input.user;
    if (!user) {
      const current = await getCurrentUser();
      user = current?.username ?? "anonyme";
    }
    const entry: AuditEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      user,
      action: input.action,
      target: input.target ?? null,
      result: input.result ?? "success",
      details: input.details ?? null,
    };
    const all = await readAll();
    all.unshift(entry);
    await writeStore(STORE_KEY, all.slice(0, MAX_ENTRIES));
  } catch (e) {
    console.error("[audit] enregistrement échoué :", e instanceof Error ? e.message : e);
  }
}

export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  const all = await readAll();
  return all.slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}
