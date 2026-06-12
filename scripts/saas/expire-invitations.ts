/* saas:expire-invitations — passe les invitations pending échues en 'expired'. */

import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    let n = 0;
    try {
      const res = await client.query("UPDATE tenant_invitations SET status='expired', updated_at=now() WHERE status='pending' AND expires_at < now()");
      n = res.rowCount ?? 0;
    } catch {
      console.log("⚠️  Table tenant_invitations absente — exécutez `npm run db:push`.");
      process.exit(0);
    }
    console.log(`✅ expire-invitations : ${n} invitation(s) expirée(s).`);
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:expire-invitations :", e instanceof Error ? e.message : String(e)); process.exit(1); });
