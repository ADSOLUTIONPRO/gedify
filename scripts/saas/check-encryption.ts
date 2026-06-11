/* saas:check-encryption — état du chiffrement au repos (lecture seule).

   Vérifie : présence/validité de la KEK (ENCRYPTION_MASTER_KEY) SANS l'afficher,
   couverture des clés tenant, et que chaque DEK stockée peut être DÉWRAPPÉE avec
   la KEK courante (détecte une KEK erronée). N'écrit rien, n'expose aucun secret. */

import { createDecipheriv } from "node:crypto";
import { Client } from "pg";

function parseMasterKey(): Buffer | null {
  const v = (process.env.ENCRYPTION_MASTER_KEY ?? "").trim();
  if (!v) return null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, "hex");
  try { const b = Buffer.from(v, "base64"); if (b.length === 32) return b; } catch { /* ignore */ }
  return null;
}

function unwrap(kek: Buffer, wrapped: string, tenantId: string): boolean {
  try {
    const raw = Buffer.from(wrapped, "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const d = createDecipheriv("aes-256-gcm", kek, iv);
    d.setAAD(Buffer.from(`tenant-dek:${tenantId}`, "utf8"));
    d.setAuthTag(tag);
    const dek = Buffer.concat([d.update(ct), d.final()]);
    return dek.length === 32;
  } catch {
    return false;
  }
}

async function main() {
  const kek = parseMasterKey();
  const present = Boolean((process.env.ENCRYPTION_MASTER_KEY ?? "").trim());
  console.log("Chiffrement au repos :");
  console.log(`   • ENCRYPTION_MASTER_KEY : ${present ? (kek ? "présente & valide (32 octets)" : "présente mais INVALIDE") : "absente"}`);
  console.log(`   • Chiffrement actif      : ${kek ? "oui" : "non"}`);

  const url = process.env.DATABASE_URL;
  if (!url) { console.log("\n(DATABASE_URL absente — pas de stats base.)"); process.exit(0); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const tenants = Number((await client.query("SELECT COUNT(*)::int n FROM tenants").catch(() => ({ rows: [{ n: -1 }] }))).rows[0]?.n ?? -1);
    let keyRows: Array<{ tenant_id: string; wrapped_dek: string }> = [];
    try {
      keyRows = (await client.query("SELECT tenant_id, wrapped_dek FROM tenant_encryption_keys")).rows as Array<{ tenant_id: string; wrapped_dek: string }>;
    } catch {
      console.log("\n   ⚠️  Table tenant_encryption_keys absente — exécutez `npm run db:push`.");
      process.exit(0);
    }

    console.log("\nBase :");
    console.log(`   • Tenants                : ${tenants}`);
    console.log(`   • Clés tenant stockées   : ${keyRows.length}`);
    if (tenants >= 0 && keyRows.length < tenants) {
      console.log(`   ⚠️  ${tenants - keyRows.length} tenant(s) sans clé — générez-les via /admin/saas/encryption.`);
    }

    if (kek && keyRows.length > 0) {
      let ok = 0, bad = 0;
      for (const r of keyRows) (unwrap(kek, String(r.wrapped_dek), String(r.tenant_id)) ? ok++ : bad++);
      console.log(`   • DEK déwrappables (KEK) : ${ok}/${keyRows.length}`);
      if (bad > 0) console.log(`   ❌ ${bad} clé(s) NON déchiffrable(s) avec la KEK courante — KEK erronée ou changée ! Les fichiers de ces tenants seront illisibles.`);
      else console.log("   ✅ Toutes les clés tenant correspondent à la KEK courante.");
    } else if (!kek && keyRows.length > 0) {
      console.log("   ⚠️  Des clés tenant existent mais aucune KEK valide n'est configurée : fichiers chiffrés illisibles tant que la KEK n'est pas fournie.");
    }
    console.log("\n✅ check-encryption terminé (aucun secret affiché).");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-encryption :", e instanceof Error ? e.message : String(e)); process.exit(1); });
