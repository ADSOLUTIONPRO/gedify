/* gedify:db:push — applique le schéma PostgreSQL (prisma/sql/init.sql) via `pg`.

   Idempotent (le DDL utilise IF NOT EXISTS) et SANS dépendre du CLI Prisma ni du
   schema-engine natif (absents de l'image runtime). Le SQL est généré depuis
   prisma/schema.prisma au build (`prisma migrate diff`). */

import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

function sqlPath(): string {
  // init.sql est livré à <cwd>/prisma/sql/init.sql (cwd = /app en production).
  return path.join(process.cwd(), "prisma", "sql", "init.sql");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL absente — impossible d'appliquer le schéma.");
    process.exit(1);
  }
  const file = sqlPath();
  const sql = readFileSync(file, "utf8");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql); // tout le script en une fois (IF NOT EXISTS → idempotent)
    console.log(`✅ Schéma PostgreSQL appliqué (idempotent) depuis ${file}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ db:push :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
