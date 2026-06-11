/* saas:check-encryption — état du chiffrement au repos (lecture seule).

   Vérifie : présence/validité de la KEK (ENCRYPTION_MASTER_KEY) SANS l'afficher,
   couverture des clés tenant, que chaque DEK stockée se déwrappe avec la KEK
   courante, et un INVENTAIRE des fichiers documents (chiffrés vs en clair,
   sans tenant, illisibles). N'écrit rien, n'expose aucun secret. */

import { Client } from "pg";
import {
  parseMasterKey, loadDocuments, loadTenantDeks, filesForDocument,
  isEnvelope, readHeader, decodeEnvelope, gcmDecrypt,
} from "./encryption-shared";
import fs from "node:fs";

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
    // ── Clés tenant ──
    let keyRows: Array<{ tenant_id: string; wrapped_dek: string }> = [];
    try {
      keyRows = (await client.query("SELECT tenant_id, wrapped_dek FROM tenant_encryption_keys")).rows as typeof keyRows;
    } catch {
      console.log("\n   ⚠️  Table tenant_encryption_keys absente — exécutez `npm run db:push`.");
      process.exit(0);
    }
    const tenants = Number((await client.query("SELECT COUNT(*)::int n FROM tenants").catch(() => ({ rows: [{ n: -1 }] }))).rows[0]?.n ?? -1);

    console.log("\nClés :");
    console.log(`   • Tenants                : ${tenants}`);
    console.log(`   • Clés tenant stockées   : ${keyRows.length}`);
    if (tenants >= 0 && keyRows.length < tenants) {
      console.log(`   ⚠️  ${tenants - keyRows.length} tenant(s) sans clé — générez-les via /admin/saas/encryption.`);
    }
    const deks = kek ? await loadTenantDeks(client, kek) : new Map<string, Buffer>();
    if (kek && keyRows.length > 0) {
      const bad = keyRows.length - deks.size;
      console.log(`   • DEK déwrappables (KEK) : ${deks.size}/${keyRows.length}`);
      if (bad > 0) console.log(`   ❌ ${bad} clé(s) NON déchiffrable(s) avec la KEK courante — KEK erronée/changée !`);
      else console.log("   ✅ Toutes les clés tenant correspondent à la KEK courante.");
    }

    // ── Inventaire des fichiers documents ──
    const docs = await loadDocuments(client);
    const inv = { found: 0, encrypted: 0, plain: 0, noTenant: 0, noKey: 0, undecryptable: 0 };
    for (const doc of docs) {
      const files = filesForDocument(doc.id, doc.storedFilename);
      for (const f of files) {
        inv.found++;
        let header: Buffer;
        try { header = readHeader(f.path); } catch { inv.undecryptable++; continue; }
        if (!isEnvelope(header)) {
          inv.plain++;
          if (!doc.tenantId) inv.noTenant++;
          continue;
        }
        inv.encrypted++;
        // Tentative de déchiffrement-vérification (auth GCM) si la DEK est dispo.
        try {
          const full = fs.readFileSync(f.path);
          const { keyId, parts } = decodeEnvelope(full);
          const dek = deks.get(keyId);
          if (!dek) { inv.noKey++; continue; }
          gcmDecrypt(dek, parts, Buffer.from(keyId, "utf8")); // lève si tampon/clé invalide
        } catch {
          inv.undecryptable++;
        }
      }
    }

    console.log("\nFichiers documents :");
    console.log(`   • Trouvés                : ${inv.found}`);
    console.log(`   • Chiffrés               : ${inv.encrypted}`);
    console.log(`   • En clair               : ${inv.plain}`);
    if (inv.plain > 0) console.log(`   ⚠️  ${inv.plain} fichier(s) en clair — lancez \`npm run saas:encrypt-existing-files\`.`);
    if (inv.noTenant > 0) console.log(`   ⚠️  ${inv.noTenant} fichier(s) en clair sans tenant_id (lancez saas:attach-data avant migration).`);
    if (inv.noKey > 0) console.log(`   ⚠️  ${inv.noKey} fichier(s) chiffré(s) dont la clé tenant est absente/illisible.`);
    if (inv.undecryptable > 0) console.log(`   ❌ ${inv.undecryptable} fichier(s) illisible(s)/non déchiffrable(s) !`);
    else if (inv.encrypted > 0) console.log("   ✅ Tous les fichiers chiffrés sont déchiffrables.");

    console.log("\n✅ check-encryption terminé (aucun secret affiché).");
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:check-encryption :", e instanceof Error ? e.message : String(e)); process.exit(1); });
