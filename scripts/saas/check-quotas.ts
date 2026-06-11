/* saas:check-quotas — usage vs limites par tenant (Phase 7, lecture seule).

   Autonome via `pg` (DATABASE_URL), exécutable dans le conteneur runtime
   (`node scripts/saas/check-quotas.mjs`).

   Pour chaque tenant : plan, users used/limit, documents used/limit,
   storage used/limit (Mo), et fonctionnalités (ai/ocr/email/onlyoffice).
   Limites effectives = tenant_settings, sinon défauts du plan (dupliqués ici
   pour rester autonome — miroir de src/lib/saas/plans.ts).

   exit 0 si aucun dépassement, exit 1 si au moins un quota est dépassé. */

import { Client } from "pg";

type PlanDef = { maxUsers: number | null; maxDocuments: number | null; maxStorageMb: number | null; ai: boolean; ocr: boolean; email: boolean; office: boolean };
const PLAN_DEFAULTS: Record<string, PlanDef> = {
  free: { maxUsers: 1, maxDocuments: 50, maxStorageMb: 250, ai: false, ocr: true, email: false, office: false },
  test: { maxUsers: 3, maxDocuments: 100, maxStorageMb: 500, ai: true, ocr: true, email: false, office: true },
  pro: { maxUsers: 5, maxDocuments: 2000, maxStorageMb: 5000, ai: true, ocr: true, email: true, office: true },
  business: { maxUsers: 20, maxDocuments: 20000, maxStorageMb: 50000, ai: true, ocr: true, email: true, office: true },
  internal: { maxUsers: null, maxDocuments: null, maxStorageMb: null, ai: true, ocr: true, email: true, office: true },
};

function fmt(used: number, limit: number | null): string {
  return `${used}/${limit == null ? "∞" : limit}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }

  const client = new Client({ connectionString: url });
  await client.connect();
  let overCount = 0;
  try {
    const tenants = await client.query("SELECT id, name, plan FROM tenants ORDER BY id");
    if (tenants.rows.length === 0) { console.log("Aucun tenant."); process.exit(0); }

    for (const t of tenants.rows) {
      const tenantId = String(t.id);
      const plan = (t.plan ?? "free").toLowerCase();
      const def = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.free;

      const s = await client.query("SELECT * FROM tenant_settings WHERE tenant_id=$1 LIMIT 1", [tenantId]);
      const set = s.rows[0];
      const limMaxUsers = set ? (set.max_users == null ? null : Number(set.max_users)) : def.maxUsers;
      const limMaxDocs = set ? (set.max_documents == null ? null : Number(set.max_documents)) : def.maxDocuments;
      const limMaxMb = set ? (set.max_storage_mb == null ? null : Number(set.max_storage_mb)) : def.maxStorageMb;
      const ai = set ? set.ai_enabled !== false : def.ai;
      const ocr = set ? set.ocr_enabled !== false : def.ocr;
      const email = set ? set.email_import_enabled !== false : def.email;
      const office = set ? set.onlyoffice_enabled !== false : def.office;

      const users = Number((await client.query("SELECT COUNT(*)::int AS n FROM memberships WHERE tenant_id=$1", [tenantId])).rows[0]?.n ?? 0);
      const docs = Number((await client.query("SELECT COUNT(*)::int AS n FROM documents WHERE tenant_id=$1 AND COALESCE((raw->>'deleted')::boolean,false)=false", [tenantId]).catch(() => ({ rows: [{ n: 0 }] }))).rows[0]?.n ?? 0);
      const bytes = Number((await client.query("SELECT COALESCE(SUM(NULLIF(raw->>'archiveSize','')::bigint),0)::bigint AS n FROM documents WHERE tenant_id=$1 AND COALESCE((raw->>'deleted')::boolean,false)=false", [tenantId]).catch(() => ({ rows: [{ n: 0 }] }))).rows[0]?.n ?? 0);
      const mb = Math.round(bytes / (1024 * 1024));

      const over: string[] = [];
      if (limMaxUsers != null && users > limMaxUsers) over.push("users");
      if (limMaxDocs != null && docs > limMaxDocs) over.push("documents");
      if (limMaxMb != null && mb > limMaxMb) over.push("storage");
      if (over.length) overCount++;

      console.log(`• ${tenantId} (${t.name ?? ""}) plan=${plan}`);
      console.log(`    users ${fmt(users, limMaxUsers)} | documents ${fmt(docs, limMaxDocs)} | storage ${fmt(mb, limMaxMb)} Mo`);
      console.log(`    features: ai=${ai} ocr=${ocr} email=${email} onlyoffice=${office}${over.length ? `   ⚠️ DÉPASSEMENT: ${over.join(", ")}` : ""}`);
    }

    console.log("");
    if (overCount === 0) {
      console.log("✅ Aucun dépassement de quota.");
      process.exit(0);
    } else {
      console.error(`❌ ${overCount} tenant(s) en dépassement de quota.`);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ saas:check-quotas :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
