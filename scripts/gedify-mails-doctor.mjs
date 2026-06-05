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

// scripts/mails-doctor.ts
function maskEmail(email) {
  if (!email) return "\u2014";
  const [local, domain] = email.split("@");
  if (!domain) return "\u2022\u2022\u2022";
  return `${(local ?? "").slice(0, 1)}***@${domain}`;
}
function normEmail(e) {
  return (e ?? "").trim().toLowerCase();
}
function main() {
  const argv = process.argv;
  const root = dataDir();
  const accounts = loadArray(root, "accounts.json");
  const tokens = loadArray(root, "gmail-tokens.json");
  const links = loadArray(root, "mail-document-links.json");
  const contacts = loadArray(root, "email-contacts.json");
  const hidden = loadArray(root, "hidden-senders.json");
  const suppressed = loadArray(root, "mail-suppressed-attachments.json");
  const logs = loadArray(root, "logs.json");
  const now = Date.now();
  const tokensExpired = tokens.filter((t) => t.accessTokenExpiresAt != null && t.accessTokenExpiresAt < now).length;
  const linkBy = (s) => links.filter((l) => l.status === s).length;
  const syncErrors = logs.filter((l) => l.status === "error").length;
  const lastSyncAt = accounts.map((a) => a.lastSyncAt).filter((d) => Boolean(d)).sort((a, b) => b.localeCompare(a))[0] ?? null;
  const byEmail = /* @__PURE__ */ new Map();
  for (const c of contacts) {
    const k = normEmail(c.email);
    if (!k) continue;
    (byEmail.get(k) ?? byEmail.set(k, []).get(k)).push(c);
  }
  const dupContacts = [...byEmail.values()].filter((g) => g.length > 1);
  const report = {
    dataDir: root,
    accounts: { total: accounts.length, active: accounts.filter((a) => a.isActive).length, withError: accounts.filter((a) => Boolean(a.lastError)).length },
    lastSyncAt,
    syncErrors,
    tokens: { total: tokens.length, expired: tokensExpired },
    links: { total: links.length, imported: linkBy("imported"), pending: linkBy("pending"), error: linkBy("error"), ignored: linkBy("ignored") },
    contacts: contacts.length,
    contactDuplicates: dupContacts.length,
    hiddenSenders: hidden.length,
    suppressedAttachments: suppressed.length
  };
  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (argv.includes("--tokens")) {
    console.log(`
\u{1F511} Tokens mail : ${tokens.length}`);
    for (const t of tokens) {
      const exp = t.accessTokenExpiresAt != null ? t.accessTokenExpiresAt < now ? "\u26A0\uFE0F expir\xE9" : "valide" : "\u2014";
      console.log(`  ${maskEmail(t.email).padEnd(22)} refresh:${t.encryptedRefreshToken ? "oui" : "non"} ${exp}`);
    }
    console.log("\n\u2139\uFE0F  Les valeurs de tokens ne sont JAMAIS affich\xE9es.\n");
    return;
  }
  if (argv.includes("--links")) {
    console.log(`
\u{1F517} Liens mail\u2194document : ${report.links.total}`);
    console.log(`  import\xE9s : ${report.links.imported}  \xB7  en attente : ${report.links.pending}  \xB7  erreur : ${report.links.error}  \xB7  ignor\xE9s : ${report.links.ignored}`);
    console.log("");
    return;
  }
  if (argv.includes("--contacts-dedupe")) {
    console.log(`
\u{1F465} Contacts en double : ${dupContacts.length} groupe(s)`);
    for (const g of dupContacts.slice(0, 50)) console.log(`  ${maskEmail(g[0].email)} \xD7 ${g.length}`);
    console.log("\n\u2139\uFE0F  Fusion \xE0 faire via l'UI Messagerie \u203A Contacts.\n");
    return;
  }
  console.log(`
\u{1F4EC} Messagerie \u2014 ${root}`);
  console.log(`\u{1F4E8} Comptes : ${report.accounts.total} (actifs ${report.accounts.active}, en erreur ${report.accounts.withError})`);
  console.log(`\u{1F551} Dernier sync : ${lastSyncAt ? new Date(lastSyncAt).toLocaleString("fr-FR") : "\u2014"}  \xB7  erreurs sync : ${syncErrors}`);
  console.log(`\u{1F511} Tokens : ${report.tokens.total} (expir\xE9s ${report.tokens.expired})`);
  console.log(`\u{1F517} Liens mail\u2194doc : ${report.links.total} (import\xE9s ${report.links.imported}, en attente ${report.links.pending}, erreur ${report.links.error})`);
  console.log(`\u{1F465} Contacts : ${report.contacts} (doublons ${report.contactDuplicates})`);
  console.log(`\u{1F648} Exp\xE9diteurs masqu\xE9s : ${report.hiddenSenders}  \xB7  PJ supprim\xE9es : ${report.suppressedAttachments}`);
  console.log("\n\u2139\uFE0F  Options : --tokens \xB7 --links \xB7 --contacts-dedupe \xB7 --json   (lecture seule, aucun secret)\n");
}
main();
