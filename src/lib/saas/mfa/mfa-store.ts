import "server-only";

import { randomUUID, randomBytes, createHash } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { gcmEncrypt, gcmDecrypt } from "@/lib/saas/encryption/envelope";
import { generateTotpSecret, verifyTotp, otpauthUri } from "./totp";

/* Stockage MFA/TOTP. Le secret TOTP est TOUJOURS chiffré au repos (AES-256-GCM,
   clé dérivée d'AUTH_SECRET — jamais en base, jamais affichée). Codes de secours
   stockés hashés (SHA-256), à usage unique. */

function mfaKey(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquant (chiffrement MFA impossible).");
  return createHash("sha256").update(`${s}:mfa`).digest();
}
function encryptSecret(plain: string): string {
  const { iv, tag, ciphertext } = gcmEncrypt(mfaKey(), Buffer.from(plain, "utf8"));
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}
function decryptSecret(enc: string): string {
  const raw = Buffer.from(enc, "base64");
  return gcmDecrypt(mfaKey(), { iv: raw.subarray(0, 12), tag: raw.subarray(12, 28), ciphertext: raw.subarray(28) }).toString("utf8");
}
function hashCode(code: string): string {
  return createHash("sha256").update(code.replace(/\s|-/g, "").toUpperCase()).digest("hex");
}
function genBackupCodes(n = 10): string[] {
  return Array.from({ length: n }, () => randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})(.{5})/, "$1-$2"));
}

const DDL = `
CREATE TABLE IF NOT EXISTS user_mfa (
  id TEXT PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL, method TEXT NOT NULL DEFAULT 'totp',
  secret_enc TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false, confirmed_at TIMESTAMPTZ,
  backup_codes JSONB, last_used_at TIMESTAMPTZ, failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
let ddlEnsured = false;
async function ensureTable() { if (ddlEnsured) return; const pool = await getPool(); await pool.query(DDL); ddlEnsured = true; }

export type MfaState = { enabled: boolean; pending: boolean; backupRemaining: number };

async function row(userId: number): Promise<Record<string, unknown> | null> {
  if (!postgresActive()) return null;
  await ensureTable();
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM user_mfa WHERE user_id=$1 LIMIT 1", [userId]);
  return rows[0] ?? null;
}

export async function getMfaState(userId: number): Promise<MfaState> {
  const r = await row(userId).catch(() => null);
  if (!r) return { enabled: false, pending: false, backupRemaining: 0 };
  const codes = Array.isArray(r.backup_codes) ? (r.backup_codes as { usedAt: string | null }[]) : [];
  return { enabled: r.enabled === true, pending: r.enabled !== true && Boolean(r.secret_enc), backupRemaining: codes.filter((c) => !c.usedAt).length };
}

export async function isMfaEnabled(userId: number): Promise<boolean> {
  return (await getMfaState(userId)).enabled;
}

/** Démarre (ou recommence) l'enrôlement : génère un secret + QR. enabled=false. */
export async function startEnrollment(userId: number, accountLabel: string): Promise<{ otpauth: string; qrSvg: string; secret: string }> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  await ensureTable();
  const pool = await getPool();
  const secret = generateTotpSecret();
  const enc = encryptSecret(secret);
  const existing = await pool.query("SELECT id, enabled FROM user_mfa WHERE user_id=$1 LIMIT 1", [userId]);
  if (existing.rows[0]) {
    // On ne réinitialise un secret QUE si la MFA n'est pas déjà active.
    if (existing.rows[0].enabled === true) throw new Error("MFA déjà active. Désactivez-la d'abord pour la reconfigurer.");
    await pool.query("UPDATE user_mfa SET secret_enc=$2, enabled=false, confirmed_at=NULL, backup_codes=NULL, updated_at=now() WHERE user_id=$1", [userId, enc]);
  } else {
    await pool.query("INSERT INTO user_mfa(id, user_id, secret_enc, enabled) VALUES ($1,$2,$3,false)", [randomUUID(), userId, enc]);
  }
  const otpauth = otpauthUri(secret, accountLabel);
  const QR = (await import("qrcode")).default;
  const qrSvg = await QR.toString(otpauth, { type: "svg", margin: 1, width: 200 });
  return { otpauth, qrSvg, secret };
}

/** Confirme l'enrôlement avec un code TOTP → active la MFA, renvoie les codes de secours. */
export async function confirmEnable(userId: number, code: string): Promise<string[]> {
  const r = await row(userId);
  if (!r) throw new Error("Aucun enrôlement en cours.");
  if (r.enabled === true) throw new Error("MFA déjà active.");
  const secret = decryptSecret(String(r.secret_enc));
  if (!verifyTotp(secret, code)) throw new Error("Code invalide. Vérifiez l'heure de votre téléphone et réessayez.");
  const codes = genBackupCodes();
  const stored = codes.map((c) => ({ hash: hashCode(c), usedAt: null as string | null }));
  const pool = await getPool();
  await pool.query("UPDATE user_mfa SET enabled=true, confirmed_at=now(), backup_codes=$2, failed_count=0, updated_at=now() WHERE user_id=$1", [userId, JSON.stringify(stored)]);
  return codes;
}

/** Vérifie un code (TOTP ou code de secours) lors de la connexion. */
export async function verifyMfaCode(userId: number, code: string): Promise<boolean> {
  const r = await row(userId);
  if (!r || r.enabled !== true) return false;
  const secret = decryptSecret(String(r.secret_enc));
  const pool = await getPool();
  if (verifyTotp(secret, code)) {
    await pool.query("UPDATE user_mfa SET last_used_at=now(), failed_count=0, updated_at=now() WHERE user_id=$1", [userId]);
    return true;
  }
  // Code de secours ?
  const codes = Array.isArray(r.backup_codes) ? (r.backup_codes as { hash: string; usedAt: string | null }[]) : [];
  const h = hashCode(code);
  const match = codes.find((c) => c.hash === h && !c.usedAt);
  if (match) {
    match.usedAt = new Date().toISOString();
    await pool.query("UPDATE user_mfa SET backup_codes=$2, last_used_at=now(), failed_count=0, updated_at=now() WHERE user_id=$1", [userId, JSON.stringify(codes)]);
    return true;
  }
  await pool.query("UPDATE user_mfa SET failed_count=failed_count+1, updated_at=now() WHERE user_id=$1", [userId]).catch(() => {});
  return false;
}

export async function regenerateBackupCodes(userId: number): Promise<string[]> {
  const r = await row(userId);
  if (!r || r.enabled !== true) throw new Error("MFA non active.");
  const codes = genBackupCodes();
  const stored = codes.map((c) => ({ hash: hashCode(c), usedAt: null as string | null }));
  const pool = await getPool();
  await pool.query("UPDATE user_mfa SET backup_codes=$2, updated_at=now() WHERE user_id=$1", [userId, JSON.stringify(stored)]);
  return codes;
}

/** Désactive la MFA de l'utilisateur courant (exige un code valide). */
export async function disableMfa(userId: number, code: string): Promise<void> {
  if (!(await verifyMfaCode(userId, code))) throw new Error("Code invalide.");
  const pool = await getPool();
  await pool.query("DELETE FROM user_mfa WHERE user_id=$1", [userId]);
}

/** Réinitialisation administrative (superadmin) : supprime la MFA d'un utilisateur. */
export async function resetMfa(userId: number): Promise<void> {
  if (!postgresActive()) return;
  await ensureTable();
  const pool = await getPool();
  await pool.query("DELETE FROM user_mfa WHERE user_id=$1", [userId]);
}
