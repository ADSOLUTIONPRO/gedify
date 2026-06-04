/* gedify:db:check — vérifie la connexion PostgreSQL et les droits (non destructif).
   N'écrit aucune donnée (juste une table sonde créée puis supprimée).
   N'affiche jamais le mot de passe / la chaîne de connexion. */

import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL absente. Renseigne-la dans les variables Coolify.");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });

  try {
    await client.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`❌ Connexion impossible : ${msg}`);
    if (/role .* does not exist|password authentication failed/i.test(msg)) {
      console.error("   → utilisateur/mot de passe incorrects. Copie la chaîne EXACTE depuis");
      console.error("     Coolify → service PostgreSQL → connexion interne.");
    } else if (/ENOTFOUND|getaddrinfo|ECONNREFUSED/i.test(msg)) {
      console.error("   → hôte injoignable : Gedify et la base ne partagent pas le réseau Coolify.");
    } else if (/SSL|self-signed/i.test(msg)) {
      console.error("   → ajoute ?sslmode=require (ou ?sslmode=no-verify) à DATABASE_URL.");
    }
    process.exit(1);
  }

  try {
    const who = await client.query("select current_user as u, current_database() as d");
    console.log(`✅ Connecté — utilisateur="${who.rows[0].u}", base="${who.rows[0].d}"`);
    try {
      await client.query("create table if not exists _gedify_probe (x int)");
      await client.query("drop table _gedify_probe");
      console.log("✅ Droits CREATE/DROP OK — `gedify:db:push` est possible.");
    } catch (e) {
      console.error(`⚠️  Droits insuffisants pour créer des tables : ${e instanceof Error ? e.message : String(e)}`);
      console.error("   → utilise la base dont cet utilisateur est PROPRIÉTAIRE, ou accorde les droits sur le schéma public.");
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ db:check :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
