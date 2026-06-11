/* saas:create-tenant — création de tenant en CLI (Phase 6).

   Idempotent, autonome via `pg` (DATABASE_URL) + bcrypt. Exécutable dans le
   conteneur runtime (`node scripts/saas/create-tenant.mjs`).

   Usage :
     npm run saas:create-tenant -- --slug=demo --name="Demo Client" --email=demo@gedify.local
   Options : --slug (requis) --email (requis) --name --username --password
     --plan(free|test|pro|business|internal) --status(active|trial|suspended)
     --max-users --max-documents --max-storage-mb
     --ai=false --ocr=false --email-import=true --onlyoffice=false */

import { Client } from "pg";
import bcrypt from "bcryptjs";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const PLANS = ["free", "test", "pro", "business", "internal"];
const STATUSES = ["active", "trial", "suspended"];

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    if (!a.startsWith("--")) continue;
    a = a.slice(2);
    if (a.includes("=")) {
      const idx = a.indexOf("=");
      out[a.slice(0, idx)] = a.slice(idx + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[a] = next;
        i++;
      } else {
        out[a] = "true";
      }
    }
  }
  return out;
}

function boolArg(v: string | undefined, def: boolean): boolean {
  if (v === undefined) return def;
  const s = v.trim().toLowerCase();
  return s === "" || s === "true" || s === "1" || s === "yes" || s === "on";
}
function intArg(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

const DDL = `
CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT, slug TEXT UNIQUE, plan TEXT, status TEXT, raw JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS memberships (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, tenant_id TEXT NOT NULL, role TEXT NOT NULL, raw JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS memberships_tenant_user_key ON memberships (tenant_id, user_id);
CREATE TABLE IF NOT EXISTS tenant_settings (id TEXT PRIMARY KEY, tenant_id TEXT UNIQUE, max_users INTEGER, max_documents INTEGER, max_storage_mb INTEGER, ai_enabled BOOLEAN NOT NULL DEFAULT true, ocr_enabled BOOLEAN NOT NULL DEFAULT true, email_import_enabled BOOLEAN NOT NULL DEFAULT true, onlyoffice_enabled BOOLEAN NOT NULL DEFAULT true, raw JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
`;

async function allocateUserId(client: Client): Promise<number> {
  const maxRow = await client.query(`SELECT COALESCE(MAX(id),0)::int AS m FROM users`);
  const cntRow = await client.query(`SELECT value FROM counters WHERE name='users'`);
  const newId = Math.max(Number(maxRow.rows[0]?.m ?? 0), cntRow.rows[0] ? Number(cntRow.rows[0].value) : 0) + 1;
  await client.query(
    `INSERT INTO counters(name,value) VALUES('users',$1) ON CONFLICT(name) DO UPDATE SET value=GREATEST(counters.value,$1), updated_at=now()`,
    [newId],
  );
  return newId;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL absente.");
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));

  const slug = (args.slug ?? "").trim().toLowerCase();
  const email = (args.email ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    console.error("❌ --slug invalide (minuscules, chiffres, tirets ; 2–40).");
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("❌ --email invalide.");
    process.exit(1);
  }
  const name = (args.name ?? slug).trim();
  const username = (args.username ?? email.split("@")[0]).trim();
  const password = args.password ?? "ChangeMe123!";
  const plan = (args.plan ?? "test").trim().toLowerCase();
  const status = (args.status ?? "active").trim().toLowerCase();
  if (!PLANS.includes(plan)) { console.error(`❌ --plan invalide (${PLANS.join("|")}).`); process.exit(1); }
  if (!STATUSES.includes(status)) { console.error(`❌ --status invalide (${STATUSES.join("|")}).`); process.exit(1); }

  const settings = {
    maxUsers: intArg(args["max-users"]),
    maxDocuments: intArg(args["max-documents"]),
    maxStorageMb: intArg(args["max-storage-mb"]),
    ai: boolArg(args.ai, true),
    ocr: boolArg(args.ocr, true),
    emailImport: boolArg(args["email-import"], false),
    onlyoffice: boolArg(args.onlyoffice, true),
  };

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(DDL);

    // Owner : réutilisé si email/username existe, sinon créé (id sans collision).
    const found = await client.query(
      `SELECT id FROM users WHERE lower(username)=lower($1) OR lower(email)=lower($2) LIMIT 1`,
      [username, email],
    );
    let userId: number;
    let userCreated = false;
    if (found.rows[0]) {
      userId = Number(found.rows[0].id);
    } else {
      userId = await allocateUserId(client);
      const passwordHash = await bcrypt.hash(password, 10);
      const metadata = { id: userId, username, passwordHash, email, first_name: "", last_name: "", is_superuser: false, is_staff: false, is_active: true };
      await client.query(
        `INSERT INTO users(id, username, email, password_hash, is_superuser, is_active, metadata)
         VALUES($1,$2,$3,$4,false,true,$5) ON CONFLICT(id) DO NOTHING`,
        [userId, username, email, passwordHash, JSON.stringify(metadata)],
      );
      userCreated = true;
    }

    const tRes = await client.query(
      `INSERT INTO tenants(id,name,slug,plan,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [slug, name, slug, plan, status],
    );
    const mRes = await client.query(
      `INSERT INTO memberships(id,user_id,tenant_id,role) VALUES($1,$2,$3,'owner') ON CONFLICT(id) DO NOTHING RETURNING id`,
      [`${slug}:${userId}`, userId, slug],
    );
    const sRes = await client.query(
      `INSERT INTO tenant_settings(id,tenant_id,max_users,max_documents,max_storage_mb,ai_enabled,ocr_enabled,email_import_enabled,onlyoffice_enabled)
       VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [slug, settings.maxUsers, settings.maxDocuments, settings.maxStorageMb, settings.ai, settings.ocr, settings.emailImport, settings.onlyoffice],
    );

    console.log("✅ saas:create-tenant terminé (idempotent)");
    console.log(`   • Tenant      : ${slug} (${name}) plan=${plan} status=${status} — ${tRes.rowCount ? "créé" : "déjà présent"}`);
    console.log(`   • Owner       : #${userId} ${username} <${email}> — ${userCreated ? "créé" : "réutilisé"}`);
    console.log(`   • Membership  : ${slug}:${userId} owner — ${mRes.rowCount ? "créé" : "déjà présent"}`);
    console.log(`   • Settings    : ${sRes.rowCount ? "créées" : "déjà présentes"}`);
    if (userCreated) console.log(`   ⚠️  Mot de passe : ${password}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ saas:create-tenant :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
