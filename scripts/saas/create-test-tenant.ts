/* saas:create-test-tenant — crée un 2e tenant de test + son owner (Phase 4).

   Idempotent, autonome via `pg` (DATABASE_URL), exécutable dans le conteneur
   runtime (`node scripts/saas/create-test-tenant.mjs`).

   Crée :
     • utilisateur owner clienttest / clienttest@gedify.local (non superuser) ;
     • tenant test-client (Client Test, plan test, active) ;
     • membership owner ;
     • tenant_settings (max_users 3, max_documents 50, max_storage_mb 500,
       ai+ocr+onlyoffice activés, email_import désactivé).

   Relançable sans doublon (ON CONFLICT DO NOTHING + détection de l'utilisateur). */

import { Client } from "pg";
import bcrypt from "bcryptjs";

const TENANT = { id: "test-client", name: "Client Test", slug: "test-client", plan: "test", status: "active" };
const USER = { username: "clienttest", email: "clienttest@gedify.local", password: "ClientTest123!" };
const SETTINGS = {
  maxUsers: 3,
  maxDocuments: 50,
  maxStorageMb: 500,
  aiEnabled: true,
  ocrEnabled: true,
  emailImportEnabled: false,
  onlyofficeEnabled: true,
};

const DDL = `
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY, name TEXT, slug TEXT UNIQUE, plan TEXT, status TEXT, raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, tenant_id TEXT NOT NULL, role TEXT NOT NULL, raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_tenant_user_key ON memberships (tenant_id, user_id);
CREATE TABLE IF NOT EXISTS tenant_settings (
  id TEXT PRIMARY KEY, tenant_id TEXT UNIQUE, max_users INTEGER, max_documents INTEGER, max_storage_mb INTEGER,
  ai_enabled BOOLEAN NOT NULL DEFAULT true, ocr_enabled BOOLEAN NOT NULL DEFAULT true,
  email_import_enabled BOOLEAN NOT NULL DEFAULT true, onlyoffice_enabled BOOLEAN NOT NULL DEFAULT true, raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function nextUserId(client: Client): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO counters(name, value) VALUES('users', 1)
     ON CONFLICT(name) DO UPDATE SET value = counters.value + 1, updated_at = now() RETURNING value`,
  );
  return Number(rows[0].value);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL absente — multi-tenant requiert PostgreSQL.");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(DDL);

    // 1. Utilisateur owner (idempotent : réutilise s'il existe déjà).
    const found = await client.query(
      `SELECT id FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($2) LIMIT 1`,
      [USER.username, USER.email],
    );
    let userId: number;
    let userCreated = false;
    if (found.rows[0]) {
      userId = Number(found.rows[0].id);
    } else {
      userId = await nextUserId(client);
      const passwordHash = await bcrypt.hash(USER.password, 10);
      const metadata = {
        id: userId,
        username: USER.username,
        passwordHash,
        email: USER.email,
        first_name: "",
        last_name: "",
        is_superuser: false,
        is_staff: false,
        is_active: true,
      };
      await client.query(
        `INSERT INTO users(id, username, email, password_hash, is_superuser, is_active, metadata)
         VALUES($1, $2, $3, $4, false, true, $5) ON CONFLICT(id) DO NOTHING`,
        [userId, USER.username, USER.email, passwordHash, JSON.stringify(metadata)],
      );
      userCreated = true;
    }

    // 2. Tenant
    const tRes = await client.query(
      `INSERT INTO tenants(id, name, slug, plan, status) VALUES($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO NOTHING RETURNING id`,
      [TENANT.id, TENANT.name, TENANT.slug, TENANT.plan, TENANT.status],
    );

    // 3. Membership owner
    const membershipId = `${TENANT.id}:${userId}`;
    const mRes = await client.query(
      `INSERT INTO memberships(id, user_id, tenant_id, role) VALUES($1, $2, $3, 'owner')
       ON CONFLICT(id) DO NOTHING RETURNING id`,
      [membershipId, userId, TENANT.id],
    );

    // 4. tenant_settings
    const sRes = await client.query(
      `INSERT INTO tenant_settings
         (id, tenant_id, max_users, max_documents, max_storage_mb,
          ai_enabled, ocr_enabled, email_import_enabled, onlyoffice_enabled)
       VALUES($1, $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(id) DO NOTHING RETURNING id`,
      [
        TENANT.id,
        SETTINGS.maxUsers,
        SETTINGS.maxDocuments,
        SETTINGS.maxStorageMb,
        SETTINGS.aiEnabled,
        SETTINGS.ocrEnabled,
        SETTINGS.emailImportEnabled,
        SETTINGS.onlyofficeEnabled,
      ],
    );

    console.log("✅ saas:create-test-tenant terminé (idempotent)");
    console.log(`   • Utilisateur  : #${userId} ${USER.username} <${USER.email}> — ${userCreated ? "créé" : "déjà présent"}`);
    console.log(`   • Tenant       : ${TENANT.id} (${TENANT.name}) — ${tRes.rowCount ? "créé" : "déjà présent"}`);
    console.log(`   • Membership   : ${membershipId} role=owner — ${mRes.rowCount ? "créé" : "déjà présent"}`);
    console.log(`   • TenantSettings: ${sRes.rowCount ? "créées" : "déjà présentes"} (users≤${SETTINGS.maxUsers}, docs≤${SETTINGS.maxDocuments}, ${SETTINGS.maxStorageMb}Mo)`);
    if (userCreated) console.log(`   ⚠️  Identifiants test : ${USER.email} / ${USER.password}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ saas:create-test-tenant :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
