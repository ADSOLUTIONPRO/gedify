/* saas:seed-mail-templates — insère les modèles d'emails par défaut.

   Idempotent : ON CONFLICT (key) DO NOTHING (ne réécrit pas un modèle modifié).
   Autonome via `pg` (DATABASE_URL), crée la table mail_templates si besoin. */

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { DEFAULT_TEMPLATES } from "../../src/lib/saas/mailing/templates";

const DDL = `
CREATE TABLE IF NOT EXISTS mail_templates (
  id           TEXT PRIMARY KEY,
  key          TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'system',
  subject      TEXT NOT NULL,
  html_body    TEXT NOT NULL,
  text_body    TEXT,
  locale       TEXT NOT NULL DEFAULT 'fr-FR',
  enabled      BOOLEAN NOT NULL DEFAULT true,
  layout_id    TEXT,
  description  TEXT,
  variables    JSONB,
  is_marketing BOOLEAN NOT NULL DEFAULT false,
  raw          JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_templates_category_idx ON mail_templates(category);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(DDL);
    let created = 0, skipped = 0;
    for (const t of DEFAULT_TEMPLATES) {
      const res = await client.query(
        `INSERT INTO mail_templates(id, key, name, category, subject, html_body, enabled, is_marketing, variables)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8)
         ON CONFLICT (key) DO NOTHING`,
        [randomUUID(), t.key, t.name, t.category, t.subject, t.html, t.isMarketing ?? false, JSON.stringify(t.variables)],
      );
      if (res.rowCount && res.rowCount > 0) created++; else skipped++;
    }
    console.log(`✅ seed-mail-templates : ${created} créé(s), ${skipped} déjà présent(s) sur ${DEFAULT_TEMPLATES.length}.`);
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:seed-mail-templates :", e instanceof Error ? e.message : String(e)); process.exit(1); });
