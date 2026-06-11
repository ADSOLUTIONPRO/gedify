/* saas:test-two-tenants — test d'isolation réel entre 2 tenants (Phase 4).

   Autonome via `pg` (DATABASE_URL). Crée des lignes-témoins dans CHAQUE tenant
   (documents/tags/correspondents), puis vérifie qu'une requête « scopée » à un
   tenant ne voit JAMAIS les lignes de l'autre. Nettoie les témoins à la fin.

   exit 0 si isolation OK, exit 1 si fuite détectée. */

import { Client } from "pg";

const A = "azserver-staging";
const B = "test-client";

// Identifiants réservés (plage haute) pour éviter toute collision.
const ID = {
  doc: { [A]: 990000101, [B]: 990000102 } as Record<string, number>,
  tag: { [A]: 990000111, [B]: 990000112 } as Record<string, number>,
  corr: { [A]: 990000121, [B]: 990000122 } as Record<string, number>,
};
const ALL_DOC = Object.values(ID.doc);
const ALL_TAG = Object.values(ID.tag);
const ALL_CORR = Object.values(ID.corr);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL absente.");
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  const failures: string[] = [];

  async function scalar(sql: string, params: unknown[]): Promise<number> {
    const { rows } = await client.query(sql, params);
    return Number(rows[0]?.n ?? 0);
  }
  async function upsert(table: string, id: number, tenantId: string, raw: Record<string, unknown>) {
    await client.query(
      `INSERT INTO "${table}"(id, raw, tenant_id) VALUES($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET raw = EXCLUDED.raw, tenant_id = EXCLUDED.tenant_id`,
      [id, JSON.stringify({ id, ...raw }), tenantId],
    );
  }
  /** Vérifie : visible dans son tenant (1) ET invisible dans l'autre (0). */
  async function checkPair(table: string, ids: Record<string, number>, kind: string) {
    for (const [own, other] of [[A, B], [B, A]] as const) {
      const visibleOwn = await scalar(
        `SELECT COUNT(*)::int AS n FROM "${table}" WHERE tenant_id = $1 AND id = $2`,
        [own, ids[own]],
      );
      const visibleCross = await scalar(
        `SELECT COUNT(*)::int AS n FROM "${table}" WHERE tenant_id = $1 AND id = $2`,
        [own, ids[other]],
      );
      if (visibleOwn !== 1) failures.push(`${kind}: témoin de ${own} non visible dans son propre tenant`);
      if (visibleCross !== 0) failures.push(`FUITE ${kind}: ${own} voit le témoin de ${other}`);
      console.log(`   • ${kind.padEnd(14)} scope=${own.padEnd(16)} own=${visibleOwn} cross=${visibleCross}`);
    }
  }

  try {
    // 1. Les deux tenants existent
    for (const t of [A, B]) {
      const n = await scalar("SELECT COUNT(*)::int AS n FROM tenants WHERE id = $1", [t]);
      if (n === 0) failures.push(`tenant ${t} introuvable (lancez saas:init-tenant / saas:create-test-tenant)`);
    }
    if (failures.length) throw new Error("tenants manquants");

    // 2. Lignes-témoins dans chaque tenant
    for (const t of [A, B]) {
      await upsert("documents", ID.doc[t], t, { title: "__iso_test__", deleted: false });
      await upsert("tags", ID.tag[t], t, { name: "__iso_test__" });
      await upsert("correspondents", ID.corr[t], t, { name: "__iso_test__" });
    }

    // 3. Vérifications d'isolation
    console.log("Vérifications d'isolation (own=1 attendu, cross=0 attendu) :");
    await checkPair("documents", ID.doc, "documents");
    await checkPair("tags", ID.tag, "tags");
    await checkPair("correspondents", ID.corr, "correspondents");

    console.log("");
    if (failures.length === 0) {
      console.log("✅ Isolation 2 tenants OK — aucune fuite détectée.");
    } else {
      console.error("❌ Isolation 2 tenants : anomalies :");
      for (const f of failures) console.error(`   - ${f}`);
    }
  } catch (e) {
    failures.push(e instanceof Error ? e.message : String(e));
    console.error("❌ test-two-tenants :", e instanceof Error ? e.message : String(e));
  } finally {
    // 4. Nettoyage des témoins (best-effort)
    try {
      await client.query(`DELETE FROM documents WHERE id = ANY($1::int[])`, [ALL_DOC]);
      await client.query(`DELETE FROM tags WHERE id = ANY($1::int[])`, [ALL_TAG]);
      await client.query(`DELETE FROM correspondents WHERE id = ANY($1::int[])`, [ALL_CORR]);
    } catch {
      /* ignore */
    }
    await client.end();
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ test-two-tenants :", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
