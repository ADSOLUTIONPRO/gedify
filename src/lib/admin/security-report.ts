import "server-only";

import { listUsers } from "@/lib/engine/users";
import { roleOf, type Role } from "@/lib/auth/permissions";
import { listGmailTokensPublic, isGmailStoreSecure } from "@/lib/connectors/gmail/gmail-token-store";

/* ────────────────────────────────────────────────────────────────────────
   Rapport de SÉCURITÉ (Partie 7) pour la Santé GED. LECTURE SEULE.
   RÈGLE ABSOLUE : ne renvoie JAMAIS de secret (password_hash, tokens, clés,
   AUTH_SECRET, DATABASE_URL…). Seulement présences/états/compteurs masqués.
   Pendant serveur de `gedify:security:inspect` (qui, lui, est pur-disque).
   ──────────────────────────────────────────────────────────────────────── */

export type SecurityReport = {
  status: "ok" | "warning" | "error";
  env: {
    authSecret: "présent" | "absent";
    databaseUrl: "présent" | "absent";
    storageMode: string;
    cookieSecure: string;
    openaiKey: "présent" | "absent";
    connectorSecret: "présent" | "absent";
  };
  users: { total: number; admins: number; activeAdmins: number; noPassword: number; byRole: Record<Role, number> };
  mailTokens: { total: number; expired: number; encryptionConfigured: boolean };
  warnings: string[];
  errors: string[];
  generatedAt: string;
};

function present(name: string): "présent" | "absent" {
  const v = process.env[name];
  return v && v.trim() ? "présent" : "absent";
}

export async function computeSecurityReport(): Promise<SecurityReport> {
  const users = await listUsers();
  const byRole: Record<Role, number> = { admin: 0, manager: 0, editor: 0, viewer: 0 };
  let activeAdmins = 0;
  let noPassword = 0;
  for (const u of users) {
    const r = roleOf(u);
    byRole[r] += 1;
    if (r === "admin" && u.is_active !== false) activeAdmins += 1;
    if (!(u.passwordHash && u.passwordHash.trim())) noPassword += 1;
  }

  let tokens: Awaited<ReturnType<typeof listGmailTokensPublic>> = [];
  try {
    tokens = await listGmailTokensPublic();
  } catch {
    tokens = [];
  }
  const expired = tokens.filter((t) => t.expired === true).length;

  const env = {
    authSecret: present("AUTH_SECRET"),
    databaseUrl: present("DATABASE_URL"),
    storageMode: process.env.GEDIFY_STORAGE_MODE?.trim() || "json",
    cookieSecure: process.env.COOKIE_SECURE?.trim() || "(défaut)",
    openaiKey: present("OPENAI_API_KEY"),
    connectorSecret: isGmailStoreSecure() ? ("présent" as const) : ("absent" as const),
  };

  const warnings: string[] = [];
  const errors: string[] = [];
  if (process.env.GEDIFY_LOCAL_NO_AUTH === "1")
    errors.push("GEDIFY_LOCAL_NO_AUTH=1 : authentification désactivée — à retirer sur un serveur en ligne.");
  if (env.authSecret === "absent") errors.push("AUTH_SECRET absent — sessions non stables.");
  else if ((process.env.AUTH_SECRET ?? "").length < 32)
    warnings.push("AUTH_SECRET court (< 32 caractères) — préférez une valeur longue et aléatoire.");
  if (env.storageMode === "postgres" && env.databaseUrl === "absent")
    errors.push("Mode postgres mais DATABASE_URL absent.");
  if (users.length > 0 && activeAdmins === 0)
    warnings.push("Aucun administrateur actif — risque de perte d'accès.");
  if (noPassword > 0) warnings.push(`${noPassword} utilisateur(s) sans mot de passe.`);
  if (expired > 0) warnings.push(`${expired} token(s) mail expiré(s) — reconnexion nécessaire.`);
  if (tokens.length > 0 && env.connectorSecret === "absent")
    warnings.push("Tokens mail présents mais CONNECTOR_SECRET_KEY absent (chiffrement non garanti).");

  return {
    status: errors.length ? "error" : warnings.length ? "warning" : "ok",
    env,
    users: { total: users.length, admins: byRole.admin, activeAdmins, noPassword, byRole },
    mailTokens: { total: tokens.length, expired, encryptionConfigured: isGmailStoreSecure() },
    warnings,
    errors,
    generatedAt: new Date().toISOString(),
  };
}
