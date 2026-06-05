import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/_shared.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
function dataDir() {
  return process.env.JSON_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || process.env.APP_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}
var SKIP_DIRS = /* @__PURE__ */ new Set(["backups", "node_modules", ".next", ".git", "media", "tessdata"]);
function findJsonFiles(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
      } else if (name.endsWith(".json")) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}
function findByBasename(root, basename) {
  return findJsonFiles(root).find((f) => path.basename(f) === basename) ?? null;
}
function loadJson(file) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(file, "utf8")) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
function loadArray(root, basename) {
  const file = findByBasename(root, basename);
  if (!file) return [];
  const res = loadJson(file);
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

// scripts/security-doctor.ts
function envState(name) {
  const v = process.env[name];
  return v && v.trim() ? "pr\xE9sent" : "absent";
}
function maskEmail(email) {
  if (!email) return "\u2014";
  const [local, domain] = email.split("@");
  if (!domain) return "\u2022\u2022\u2022";
  return `${(local ?? "").slice(0, 1)}***@${domain}`;
}
function roleOf(u) {
  if (u.role) return u.role;
  if (u.is_superuser) return "admin";
  if (u.is_staff) return "manager";
  return "editor";
}
function main() {
  const root = dataDir();
  const users = loadArray(root, "users.json");
  const tokens = loadArray(root, "gmail-tokens.json");
  const env = {
    AUTH_SECRET: envState("AUTH_SECRET"),
    DATABASE_URL: envState("DATABASE_URL"),
    GEDIFY_STORAGE_MODE: process.env.GEDIFY_STORAGE_MODE?.trim() || "json",
    ENABLE_JSON_FALLBACK: process.env.ENABLE_JSON_FALLBACK?.trim() || "(d\xE9faut: true)",
    COOKIE_SECURE: process.env.COOKIE_SECURE?.trim() || "(d\xE9faut)",
    OPENAI_API_KEY: envState("OPENAI_API_KEY"),
    AI_PROVIDER: process.env.AI_PROVIDER?.trim() || "(absent)"
  };
  const userRows = users.map((u) => ({
    username: u.username ?? "\u2014",
    email: maskEmail(u.email),
    role: roleOf(u),
    active: u.is_active !== false,
    hasPassword: Boolean(u.passwordHash && u.passwordHash.trim())
  }));
  const admins = userRows.filter((u) => u.role === "admin").length;
  const activeAdmins = userRows.filter((u) => u.role === "admin" && u.active).length;
  const noPassword = userRows.filter((u) => !u.hasPassword).length;
  const now = Date.now();
  const tokenRows = tokens.map((t) => ({
    email: maskEmail(t.email),
    hasRefresh: Boolean(t.encryptedRefreshToken && t.encryptedRefreshToken.trim()),
    expired: t.accessTokenExpiresAt != null ? t.accessTokenExpiresAt < now : null,
    expiresAt: t.accessTokenExpiresAt != null ? new Date(t.accessTokenExpiresAt).toISOString() : null
  }));
  const expiredTokens = tokenRows.filter((t) => t.expired === true).length;
  const warnings = [];
  const errors = [];
  if (env.AUTH_SECRET === "absent") errors.push("AUTH_SECRET absent \u2014 d\xE9finissez-le pour des sessions stables.");
  if (env.GEDIFY_STORAGE_MODE === "postgres" && env.DATABASE_URL === "absent")
    errors.push("Mode postgres mais DATABASE_URL absent.");
  if (users.length > 0 && activeAdmins === 0)
    warnings.push("Aucun administrateur actif \u2014 risque de perte d'acc\xE8s admin.");
  if (noPassword > 0) warnings.push(`${noPassword} utilisateur(s) sans mot de passe.`);
  if (expiredTokens > 0) warnings.push(`${expiredTokens} token(s) mail expir\xE9(s) \u2014 reconnexion n\xE9cessaire.`);
  const report = {
    status: errors.length ? "error" : warnings.length ? "warning" : "ok",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    env,
    users: { total: users.length, admins, activeAdmins, noPassword },
    mailTokens: { total: tokenRows.length, expired: expiredTokens },
    warnings,
    errors
  };
  const argv = process.argv;
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ ...report, userRows, tokenRows }, null, 2));
    return;
  }
  if (argv.includes("--users")) {
    console.log(`
\u{1F464} Utilisateurs : ${userRows.length}`);
    for (const u of userRows)
      console.log(`  ${u.username.padEnd(16)} ${u.role.padEnd(8)} ${u.active ? "actif" : "inactif"} ${u.hasPassword ? "" : "\u26A0\uFE0F sans mot de passe"}`);
    console.log("\n\u2139\uFE0F  Les hash de mot de passe ne sont jamais affich\xE9s.\n");
    return;
  }
  if (argv.includes("--tokens")) {
    console.log(`
\u{1F511} Tokens mail : ${tokenRows.length}`);
    for (const t of tokenRows)
      console.log(`  ${t.email.padEnd(22)} refresh:${t.hasRefresh ? "oui" : "non"} ${t.expired == null ? "" : t.expired ? "\u26A0\uFE0F expir\xE9" : "valide"}`);
    console.log("\n\u2139\uFE0F  Les valeurs de tokens ne sont jamais affich\xE9es.\n");
    return;
  }
  console.log(`
\u{1F512} Audit s\xE9curit\xE9 Gedify \u2014 ${root}`);
  console.log(`Statut : ${report.status === "ok" ? "\u2705 ok" : report.status === "warning" ? "\u26A0\uFE0F warning" : "\u274C error"}`);
  console.log("\n\u2500\u2500 Environnement (pr\xE9sence seule) \u2500\u2500");
  console.log(`  AUTH_SECRET     : ${env.AUTH_SECRET}`);
  console.log(`  DATABASE_URL    : ${env.DATABASE_URL}`);
  console.log(`  Stockage        : ${env.GEDIFY_STORAGE_MODE}  (fallback JSON: ${env.ENABLE_JSON_FALLBACK})`);
  console.log(`  COOKIE_SECURE   : ${env.COOKIE_SECURE}`);
  console.log(`  OPENAI_API_KEY  : ${env.OPENAI_API_KEY}  (provider: ${env.AI_PROVIDER})`);
  console.log("\n\u2500\u2500 Utilisateurs \u2500\u2500");
  console.log(`  total : ${report.users.total}  \xB7  admins : ${admins} (actifs ${activeAdmins})  \xB7  sans mot de passe : ${noPassword}`);
  console.log("\n\u2500\u2500 Tokens mail \u2500\u2500");
  console.log(`  total : ${report.mailTokens.total}  \xB7  expir\xE9s : ${expiredTokens}`);
  if (warnings.length) {
    console.log("\n\u26A0\uFE0F  Avertissements :");
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (errors.length) {
    console.log("\n\u274C Erreurs :");
    for (const e of errors) console.log(`  - ${e}`);
  }
  console.log("\n\u2139\uFE0F  Options : --users \xB7 --tokens \xB7 --json   (lecture seule ; aucun secret affich\xE9)\n");
}
main();
