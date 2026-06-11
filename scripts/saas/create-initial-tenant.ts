/* saas:init-tenant — crée le tenant initial SaaS + le membership owner.

   Idempotent : relançable sans créer de doublon (ON CONFLICT DO NOTHING).
   Autonome via `pg` (DATABASE_URL), SANS CLI Prisma : exécutable directement
   dans le conteneur runtime (`node scripts/saas/create-initial-tenant.mjs`).

   Crée si besoin les tables tenants / memberships / tenant_settings
   (IF NOT EXISTS, alignées sur prisma/schema.prisma) puis :
     • tenant « AzServer Staging » (slug azserver-staging, plan internal, active)
     • trouve l'admin existant (is_superuser) et lui crée un membership owner
     • une ligne tenant_settings par défaut (plan internal : tout activé). */

import { Client } from "pg";

const TENANT_ID = "azserver-staging";
const TENANT_NAME = "AzServer Staging";
const TENANT_SLUG = "azserver-staging";
const TENANT_PLAN = "internal";
const TENANT_STATUS = "active";

const DDL = `
CREATE TABLE IF NOT EXISTS tenants (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  slug       TEXT UNIQUE,
  plan       TEXT,
  status     TEXT,
  raw        JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  tenant_id  TEXT NOT NULL,
  role       TEXT NOT NULL,
  raw        JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_tenant_user_key ON memberships (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS memberships_user_id_idx ON memberships (user_id);
CREATE INDEX IF NOT EXISTS memberships_tenant_id_idx ON memberships (tenant_id);
CREATE TABLE IF NOT EXISTS tenant_settings (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT UNIQUE,
  max_users            INTEGER,
  max_documents        INTEGER,
  max_storage_mb       INTEGER,
  ai_enabled           BOOLEAN NOT NULL DEFAULT true,
  ocr_enabled          BOOLEAN NOT NULL DEFAULT true,
  email_import_enabled BOOLEAN NOT NULL DEFAULT true,
  onlyoffice_enabled   BOOLEAN NOT NULL DEFAULT true,
  raw                  JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL absente — multi-tenant requiert PostgreSQL.");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // 1. Tables (idempotent)
    await client.query(DDL);

    // 2. Admin existant (is_superuser), sinon premier utilisateur
    const admin = await client.query(
      `SELECT id, username, email
         FROM users
        WHERE is_superuser = true AND COALESCE(is_active, true) = true
        ORDER BY id
        LIMIT 1`,
    );
    let adminRow = admin.rows[0];
    if (!adminRow) {
      const any = await client.query("SELECT id, username, email FROM users ORDER BY id LIMIT 1");
      adminRow = any.rows[0];
    }
    if (!adminRow) {
      console.error("❌ Aucun utilisateur trouvé — créez d'abord un compte admin, puis relancez.");
      process.exit(1);
    }
    const userId = Number(adminRow.id);

    // 3. Tenant (idempotent)
    const tenantRes = await client.query(
      `INSERT INTO tenants (id, name, slug, plan, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [TENANT_ID, TENANT_NAME, TENANT_SLUG, TENANT_PLAN, TENANT_STATUS],
    );
    const tenantCreated = tenantRes.rowCount === 1;

    // 4. Membership owner (idempotent)
    const membershipId = `${TENANT_ID}:${userId}`;
    const memRes = await client.query(
      `INSERT INTO memberships (id, user_id, tenant_id, role)
       VALUES ($1, $2, $3, 'owner')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [membershipId, userId, TENANT_ID],
    );
    const membershipCreated = memRes.rowCount === 1;

    // 5. tenant_settings par défaut (plan internal : aucune limite, tout activé)
    const settingsRes = await client.query(
      `INSERT INTO tenant_settings
         (id, tenant_id, max_users, max_documents, max_storage_mb,
          ai_enabled, ocr_enabled, email_import_enabled, onlyoffice_enabled)
       VALUES ($1, $1, NULL, NULL, NULL, true, true, true, true)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [TENANT_ID],
    );
    const settingsCreated = settingsRes.rowCount === 1;

    console.log("✅ saas:init-tenant terminé (idempotent)");
    console.log(`   • Tenant       : ${TENANT_ID} (${TENANT_NAME}) — ${tenantCreated ? "créé" : "déjà présent"}`);
    console.log(`   • Admin        : #${userId} ${adminRow.username ?? ""}${adminRow.email ? ` <${adminRow.email}>` : ""}`);
    console.log(`   • Membership   : ${membershipId} role=owner — ${membershipCreated ? "créé" : "déjà présent"}`);
    console.log(`   • TenantSettings: ${settingsCreated ? "créées" : "déjà présentes"}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ saas:init-tenant :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
