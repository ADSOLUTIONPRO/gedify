/* Audit de SÉCURITÉ Gedify (Partie 7). Sans tsx runtime, pur-disque.
   100 % LECTURE SEULE. RÈGLE ABSOLUE : ne JAMAIS afficher de secret
   (password_hash, tokens, OPENAI_API_KEY, AUTH_SECRET, DATABASE_URL…). On ne
   rapporte que des présences/états masqués.

   Usage :
     inspect (défaut) : posture env + utilisateurs + tokens (masqués) + alertes.
     --users          : liste utilisateurs (rôle, actif) — sans password_hash.
     --tokens         : état des tokens mail (présence/expiration, jamais la valeur).
     --json           : sortie JSON (supervision). */

import { loadArray, dataDir } from "./_shared";

type User = {
  id?: number;
  username?: string;
  email?: string;
  passwordHash?: string;
  role?: "admin" | "manager" | "editor" | "viewer";
  is_superuser?: boolean;
  is_staff?: boolean;
  is_active?: boolean;
};

type GmailToken = {
  accountId?: string;
  email?: string;
  encryptedRefreshToken?: string;
  cachedAccessToken?: string | null;
  accessTokenExpiresAt?: number | null;
};

/** Présence d'une variable sensible — JAMAIS la valeur. */
function envState(name: string): "présent" | "absent" {
  const v = process.env[name];
  return v && v.trim() ? "présent" : "absent";
}

/** Masque un email pour l'audit (identifie le compte sans dumper la PII). */
function maskEmail(email: string | undefined): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${(local ?? "").slice(0, 1)}***@${domain}`;
}

function roleOf(u: User): string {
  if (u.role) return u.role;
  if (u.is_superuser) return "admin";
  if (u.is_staff) return "manager";
  return "editor";
}

function main() {
  const root = dataDir();
  const users = loadArray<User>(root, "users.json");
  const tokens = loadArray<GmailToken>(root, "gmail-tokens.json");

  // ── Posture d'environnement (présence uniquement) ───────────────────────
  const env = {
    AUTH_SECRET: envState("AUTH_SECRET"),
    DATABASE_URL: envState("DATABASE_URL"),
    GEDIFY_STORAGE_MODE: process.env.GEDIFY_STORAGE_MODE?.trim() || "json",
    ENABLE_JSON_FALLBACK: process.env.ENABLE_JSON_FALLBACK?.trim() || "(défaut: true)",
    COOKIE_SECURE: process.env.COOKIE_SECURE?.trim() || "(défaut)",
    OPENAI_API_KEY: envState("OPENAI_API_KEY"),
    AI_PROVIDER: process.env.AI_PROVIDER?.trim() || "(absent)",
  };

  // ── Utilisateurs (jamais de hash) ───────────────────────────────────────
  const userRows = users.map((u) => ({
    username: u.username ?? "—",
    email: maskEmail(u.email),
    role: roleOf(u),
    active: u.is_active !== false,
    hasPassword: Boolean(u.passwordHash && u.passwordHash.trim()),
  }));
  const admins = userRows.filter((u) => u.role === "admin").length;
  const activeAdmins = userRows.filter((u) => u.role === "admin" && u.active).length;
  const noPassword = userRows.filter((u) => !u.hasPassword).length;

  // ── Tokens mail (présence/expiration, jamais la valeur) ─────────────────
  const now = Date.now();
  const tokenRows = tokens.map((t) => ({
    email: maskEmail(t.email),
    hasRefresh: Boolean(t.encryptedRefreshToken && t.encryptedRefreshToken.trim()),
    expired: t.accessTokenExpiresAt != null ? t.accessTokenExpiresAt < now : null,
    expiresAt: t.accessTokenExpiresAt != null ? new Date(t.accessTokenExpiresAt).toISOString() : null,
  }));
  const expiredTokens = tokenRows.filter((t) => t.expired === true).length;

  // ── Alertes ─────────────────────────────────────────────────────────────
  const warnings: string[] = [];
  const errors: string[] = [];
  if (env.AUTH_SECRET === "absent") errors.push("AUTH_SECRET absent — définissez-le pour des sessions stables.");
  if (env.GEDIFY_STORAGE_MODE === "postgres" && env.DATABASE_URL === "absent")
    errors.push("Mode postgres mais DATABASE_URL absent.");
  if (users.length > 0 && activeAdmins === 0)
    warnings.push("Aucun administrateur actif — risque de perte d'accès admin.");
  if (noPassword > 0) warnings.push(`${noPassword} utilisateur(s) sans mot de passe.`);
  if (expiredTokens > 0) warnings.push(`${expiredTokens} token(s) mail expiré(s) — reconnexion nécessaire.`);

  const report = {
    status: errors.length ? "error" : warnings.length ? "warning" : "ok",
    generatedAt: new Date().toISOString(),
    env,
    users: { total: users.length, admins, activeAdmins, noPassword },
    mailTokens: { total: tokenRows.length, expired: expiredTokens },
    warnings,
    errors,
  };

  const argv = process.argv;
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ ...report, userRows, tokenRows }, null, 2));
    return;
  }
  if (argv.includes("--users")) {
    console.log(`\n👤 Utilisateurs : ${userRows.length}`);
    for (const u of userRows)
      console.log(`  ${u.username.padEnd(16)} ${u.role.padEnd(8)} ${u.active ? "actif" : "inactif"} ${u.hasPassword ? "" : "⚠️ sans mot de passe"}`);
    console.log("\nℹ️  Les hash de mot de passe ne sont jamais affichés.\n");
    return;
  }
  if (argv.includes("--tokens")) {
    console.log(`\n🔑 Tokens mail : ${tokenRows.length}`);
    for (const t of tokenRows)
      console.log(`  ${t.email.padEnd(22)} refresh:${t.hasRefresh ? "oui" : "non"} ${t.expired == null ? "" : t.expired ? "⚠️ expiré" : "valide"}`);
    console.log("\nℹ️  Les valeurs de tokens ne sont jamais affichées.\n");
    return;
  }

  console.log(`\n🔒 Audit sécurité Gedify — ${root}`);
  console.log(`Statut : ${report.status === "ok" ? "✅ ok" : report.status === "warning" ? "⚠️ warning" : "❌ error"}`);
  console.log("\n── Environnement (présence seule) ──");
  console.log(`  AUTH_SECRET     : ${env.AUTH_SECRET}`);
  console.log(`  DATABASE_URL    : ${env.DATABASE_URL}`);
  console.log(`  Stockage        : ${env.GEDIFY_STORAGE_MODE}  (fallback JSON: ${env.ENABLE_JSON_FALLBACK})`);
  console.log(`  COOKIE_SECURE   : ${env.COOKIE_SECURE}`);
  console.log(`  OPENAI_API_KEY  : ${env.OPENAI_API_KEY}  (provider: ${env.AI_PROVIDER})`);
  console.log("\n── Utilisateurs ──");
  console.log(`  total : ${report.users.total}  ·  admins : ${admins} (actifs ${activeAdmins})  ·  sans mot de passe : ${noPassword}`);
  console.log("\n── Tokens mail ──");
  console.log(`  total : ${report.mailTokens.total}  ·  expirés : ${expiredTokens}`);
  if (warnings.length) {
    console.log("\n⚠️  Avertissements :");
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (errors.length) {
    console.log("\n❌ Erreurs :");
    for (const e of errors) console.log(`  - ${e}`);
  }
  console.log("\nℹ️  Options : --users · --tokens · --json   (lecture seule ; aucun secret affiché)\n");
}

main();
