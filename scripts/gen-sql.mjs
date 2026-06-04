/* Régénère prisma/sql/init.sql depuis prisma/schema.prisma (DDL idempotent).
   À relancer après toute modification du schéma : npm run prisma:sql
   Hors-ligne (prisma migrate diff --from-empty), sans base de données. */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const raw = execFileSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"],
  { encoding: "utf8" },
);

const ddl = raw
  .replace(/^CREATE TABLE "/gm, 'CREATE TABLE IF NOT EXISTS "')
  .replace(/^CREATE UNIQUE INDEX "/gm, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
  .replace(/^CREATE INDEX "/gm, 'CREATE INDEX IF NOT EXISTS "');

const header =
  "-- Gedify — schéma PostgreSQL (généré depuis prisma/schema.prisma, idempotent).\n" +
  "-- Régénérer après modif du schéma : npm run prisma:sql\n\n";

mkdirSync("prisma/sql", { recursive: true });
writeFileSync("prisma/sql/init.sql", header + ddl);
console.log("✓ prisma/sql/init.sql régénéré");
