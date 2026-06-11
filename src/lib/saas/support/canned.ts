import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";

/* Réponses pré-enregistrées (canned replies) pour les conseillers. */

export type CannedReply = { id: string; title: string; body: string; category: string | null; shortcut: string | null };

function rowTo(r: Record<string, unknown>): CannedReply {
  return {
    id: String(r.id), title: String(r.title), body: String(r.body),
    category: (r.category as string) ?? null, shortcut: (r.shortcut as string) ?? null,
  };
}

export async function listCannedReplies(): Promise<CannedReply[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM support_canned_replies ORDER BY category NULLS FIRST, title");
    return rows.map(rowTo);
  } catch {
    return [];
  }
}

export async function createCannedReply(input: { title: string; body: string; category?: string | null; shortcut?: string | null; createdByUserId?: number | null }): Promise<string> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  const id = randomUUID();
  await pool.query(
    "INSERT INTO support_canned_replies(id, title, body, category, shortcut, created_by_user_id) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, input.title, input.body, input.category ?? null, input.shortcut ?? null, input.createdByUserId ?? null],
  );
  return id;
}

export async function deleteCannedReply(id: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  await pool.query("DELETE FROM support_canned_replies WHERE id=$1", [id]);
}
