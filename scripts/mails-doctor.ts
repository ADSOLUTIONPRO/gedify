/* Maintenance MESSAGERIE PUR-DISQUE (Partie 12). Sans deps natives, sans tsx.
   100 % LECTURE SEULE. RÈGLE ABSOLUE : ne JAMAIS afficher de token ni de mot de
   passe (encryptedPassword, encryptedRefreshToken, cachedAccessToken). Emails
   masqués. On ne rapporte que des présences/états/compteurs.

   inspect (défaut)   : comptes (masqués), tokens, liens, contacts, sync.
   --tokens           : état des tokens mail (présence/expiration, jamais la valeur).
   --links            : liens mail↔document par statut.
   --contacts-dedupe  : contacts en double (même email normalisé).
   --json             : sortie JSON (supervision). */

import { loadArray, dataDir } from "./_shared";

type Account = { id?: string; name?: string; email?: string; provider?: string; isActive?: boolean; lastSyncAt?: string | null; lastError?: string | null };
type Token = { email?: string; encryptedRefreshToken?: string; accessTokenExpiresAt?: number | null };
type Link = { status?: "pending" | "imported" | "error" | "ignored"; paperlessDocumentId?: number | null };
type Contact = { email?: string; name?: string };
type Log = { status?: string; createdAt?: string };

function maskEmail(email?: string): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${(local ?? "").slice(0, 1)}***@${domain}`;
}

function normEmail(e?: string): string {
  return (e ?? "").trim().toLowerCase();
}

function main() {
  const argv = process.argv;
  const root = dataDir();
  const accounts = loadArray<Account>(root, "accounts.json");
  const tokens = loadArray<Token>(root, "gmail-tokens.json");
  const links = loadArray<Link>(root, "mail-document-links.json");
  const contacts = loadArray<Contact>(root, "email-contacts.json");
  const hidden = loadArray<{ email?: string }>(root, "hidden-senders.json");
  const suppressed = loadArray<unknown>(root, "mail-suppressed-attachments.json");
  const logs = loadArray<Log>(root, "logs.json");

  const now = Date.now();
  const tokensExpired = tokens.filter((t) => t.accessTokenExpiresAt != null && t.accessTokenExpiresAt < now).length;
  const linkBy = (s: string) => links.filter((l) => l.status === s).length;
  const syncErrors = logs.filter((l) => l.status === "error").length;
  const lastSyncAt = accounts.map((a) => a.lastSyncAt).filter((d): d is string => Boolean(d)).sort((a, b) => b.localeCompare(a))[0] ?? null;

  // Doublons de contacts par email normalisé.
  const byEmail = new Map<string, Contact[]>();
  for (const c of contacts) {
    const k = normEmail(c.email);
    if (!k) continue;
    (byEmail.get(k) ?? byEmail.set(k, []).get(k)!).push(c);
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
    suppressedAttachments: suppressed.length,
  };

  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (argv.includes("--tokens")) {
    console.log(`\n🔑 Tokens mail : ${tokens.length}`);
    for (const t of tokens) {
      const exp = t.accessTokenExpiresAt != null ? (t.accessTokenExpiresAt < now ? "⚠️ expiré" : "valide") : "—";
      console.log(`  ${maskEmail(t.email).padEnd(22)} refresh:${t.encryptedRefreshToken ? "oui" : "non"} ${exp}`);
    }
    console.log("\nℹ️  Les valeurs de tokens ne sont JAMAIS affichées.\n");
    return;
  }
  if (argv.includes("--links")) {
    console.log(`\n🔗 Liens mail↔document : ${report.links.total}`);
    console.log(`  importés : ${report.links.imported}  ·  en attente : ${report.links.pending}  ·  erreur : ${report.links.error}  ·  ignorés : ${report.links.ignored}`);
    console.log("");
    return;
  }
  if (argv.includes("--contacts-dedupe")) {
    console.log(`\n👥 Contacts en double : ${dupContacts.length} groupe(s)`);
    for (const g of dupContacts.slice(0, 50)) console.log(`  ${maskEmail(g[0].email)} × ${g.length}`);
    console.log("\nℹ️  Fusion à faire via l'UI Messagerie › Contacts.\n");
    return;
  }

  console.log(`\n📬 Messagerie — ${root}`);
  console.log(`📨 Comptes : ${report.accounts.total} (actifs ${report.accounts.active}, en erreur ${report.accounts.withError})`);
  console.log(`🕑 Dernier sync : ${lastSyncAt ? new Date(lastSyncAt).toLocaleString("fr-FR") : "—"}  ·  erreurs sync : ${syncErrors}`);
  console.log(`🔑 Tokens : ${report.tokens.total} (expirés ${report.tokens.expired})`);
  console.log(`🔗 Liens mail↔doc : ${report.links.total} (importés ${report.links.imported}, en attente ${report.links.pending}, erreur ${report.links.error})`);
  console.log(`👥 Contacts : ${report.contacts} (doublons ${report.contactDuplicates})`);
  console.log(`🙈 Expéditeurs masqués : ${report.hiddenSenders}  ·  PJ supprimées : ${report.suppressedAttachments}`);
  console.log("\nℹ️  Options : --tokens · --links · --contacts-dedupe · --json   (lecture seule, aucun secret)\n");
}

main();
