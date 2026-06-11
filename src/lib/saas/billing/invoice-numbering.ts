import "server-only";

import { getPool } from "@/lib/db/pg";

/* Numérotation continue, sans trou volontaire, verrouillée transactionnellement.
   Compteurs séparés facture/avoir sur le BillingProfile. Format PREFIX-YYYY-000001. */

export function formatInvoiceNumber(prefix: string, year: number, n: number): string {
  return `${prefix}-${year}-${String(n).padStart(6, "0")}`;
}

async function reserve(profileId: string, column: "next_invoice_number" | "next_credit_note_number", prefixColumn: "invoice_prefix" | "credit_note_prefix"): Promise<string> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT ${column} AS n, ${prefixColumn} AS prefix FROM billing_profiles WHERE id = $1 FOR UPDATE`,
      [profileId],
    );
    if (!rows[0]) throw new Error("Profil de facturation introuvable.");
    const n = Number(rows[0].n) || 1;
    const prefix = String(rows[0].prefix);
    await client.query(`UPDATE billing_profiles SET ${column} = $2, updated_at = now() WHERE id = $1`, [profileId, n + 1]);
    await client.query("COMMIT");
    return formatInvoiceNumber(prefix, new Date().getFullYear(), n);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function reserveInvoiceNumber(profileId: string): Promise<string> {
  return reserve(profileId, "next_invoice_number", "invoice_prefix");
}
export async function reserveCreditNoteNumber(profileId: string): Promise<string> {
  return reserve(profileId, "next_credit_note_number", "credit_note_prefix");
}
