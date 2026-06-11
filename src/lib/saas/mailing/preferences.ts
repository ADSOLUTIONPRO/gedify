import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";

/* Préférences de communication par email (désinscription par catégorie ou globale).
   Le token sert au lien public de désinscription. */

export type MailPreference = {
  id: string;
  email: string;
  tenantId: string | null;
  token: string;
  unsubAll: boolean;
  unsubMarketing: boolean;
  categories: Record<string, boolean>;
};

function rowTo(r: Record<string, unknown>): MailPreference {
  return {
    id: String(r.id),
    email: String(r.email),
    tenantId: (r.tenant_id as string) ?? null,
    token: String(r.token),
    unsubAll: r.unsub_all === true,
    unsubMarketing: r.unsub_marketing === true,
    categories: (r.categories as Record<string, boolean>) ?? {},
  };
}

export async function getOrCreatePreference(email: string, tenantId: string | null = null): Promise<MailPreference | null> {
  if (!postgresActive()) return null;
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  const pool = await getPool();
  const found = await pool.query("SELECT * FROM mail_preferences WHERE email = $1 AND tenant_id IS NOT DISTINCT FROM $2 LIMIT 1", [norm, tenantId]);
  if (found.rows[0]) return rowTo(found.rows[0]);
  const id = randomUUID();
  const token = randomUUID().replace(/-/g, "");
  try {
    await pool.query(
      "INSERT INTO mail_preferences(id, email, tenant_id, token) VALUES ($1,$2,$3,$4)",
      [id, norm, tenantId, token],
    );
  } catch {
    const retry = await pool.query("SELECT * FROM mail_preferences WHERE email = $1 AND tenant_id IS NOT DISTINCT FROM $2 LIMIT 1", [norm, tenantId]);
    return retry.rows[0] ? rowTo(retry.rows[0]) : null;
  }
  return { id, email: norm, tenantId, token, unsubAll: false, unsubMarketing: false, categories: {} };
}

/** L'email est-il désinscrit pour cette catégorie ? Les emails transactionnels
    (non marketing) ne sont JAMAIS bloqués, sauf unsubAll explicite. */
export async function isUnsubscribed(email: string, category: string, tenantId: string | null = null): Promise<boolean> {
  const pref = await getOrCreatePreference(email, tenantId);
  if (!pref) return false;
  if (pref.unsubAll) return true;
  if (category === "marketing" && pref.unsubMarketing) return true;
  return pref.categories[category] === true;
}

export async function getPreferenceByToken(token: string): Promise<MailPreference | null> {
  if (!postgresActive()) return null;
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM mail_preferences WHERE token = $1 LIMIT 1", [token]);
  return rows[0] ? rowTo(rows[0]) : null;
}

export type UnsubChange = { unsubAll?: boolean; unsubMarketing?: boolean; category?: string; value?: boolean };

export async function applyUnsubByToken(token: string, change: UnsubChange): Promise<boolean> {
  const pref = await getPreferenceByToken(token);
  if (!pref) return false;
  const pool = await getPool();
  const categories = { ...pref.categories };
  if (change.category) categories[change.category] = change.value !== false;
  await pool.query(
    "UPDATE mail_preferences SET unsub_all = $2, unsub_marketing = $3, categories = $4, updated_at = now() WHERE token = $1",
    [token, change.unsubAll ?? pref.unsubAll, change.unsubMarketing ?? pref.unsubMarketing, JSON.stringify(categories)],
  );
  return true;
}
