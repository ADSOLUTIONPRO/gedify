/* saas:encrypt-existing-files — migre les fichiers documents existants (écrits
   avant l'activation du chiffrement) vers le chiffrement au repos PAR TENANT.

   • Idempotent : un fichier déjà chiffré (en-tête d'enveloppe présent) est ignoré
     → jamais de double chiffrement.
   • Atomique : écriture dans un fichier temporaire puis renommage (l'original
     n'est jamais partiellement écrasé → rollback implicite en cas d'échec).
   • Sécurité : refuse de démarrer sans KEK valide ; ignore (sans planter) les
     fichiers d'un tenant sans DEK ; n'affiche JAMAIS de secret.
   • Options : --dry-run (simulation, aucune écriture), --quiet.

   Autonome via `pg` + primitives d'enveloppe partagées. */

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  parseMasterKey, loadDocuments, loadTenantDeks, filesForDocument, encodeEnvelope, isEnvelope, readHeader,
} from "./encryption-shared";

const DRY_RUN = process.argv.includes("--dry-run");
const QUIET = process.argv.includes("--quiet");

const RUN_DDL = `
CREATE TABLE IF NOT EXISTS encryption_migration_runs (
  id            TEXT PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  dry_run       BOOLEAN NOT NULL DEFAULT false,
  found         INTEGER NOT NULL DEFAULT 0,
  already_encrypted INTEGER NOT NULL DEFAULT 0,
  encrypted     INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  errors        INTEGER NOT NULL DEFAULT 0,
  details       JSONB
);`;

/** Écriture atomique : temp dans le même dossier + rename (POSIX atomique). */
function atomicWrite(file: string, data: Buffer): void {
  const tmp = `${file}.enc-tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw e;
  }
}

/** Nettoie d'éventuels fichiers temporaires d'un run précédent interrompu. */
function cleanupTmp(file: string): void {
  try {
    const dir = file.substring(0, file.lastIndexOf("/"));
    const base = file.substring(file.lastIndexOf("/") + 1);
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(`${base}.enc-tmp-`)) { try { fs.unlinkSync(`${dir}/${f}`); } catch { /* ignore */ } }
    }
  } catch { /* ignore */ }
}

async function main() {
  const kek = parseMasterKey();
  if (!kek) {
    console.error("❌ ENCRYPTION_MASTER_KEY absente ou invalide — migration refusée (aucun fichier modifié).");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }

  const client = new Client({ connectionString: url });
  await client.connect();

  const stats = { found: 0, alreadyEnc: 0, encrypted: 0, skipped: 0, errors: 0 };
  const noTenantDocs = new Set<number>();
  const noKeyTenants = new Set<string>();
  const runId = randomUUID();

  try {
    await client.query(RUN_DDL);
    if (!DRY_RUN) {
      await client.query("INSERT INTO encryption_migration_runs(id, dry_run) VALUES ($1,$2)", [runId, false]);
    }

    const deks = await loadTenantDeks(client, kek);
    const docs = await loadDocuments(client);
    if (!QUIET) console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}Migration : ${docs.length} document(s), ${deks.size} clé(s) tenant.`);

    for (const doc of docs) {
      if (!doc.tenantId) { noTenantDocs.add(doc.id); continue; }
      const dek = deks.get(doc.tenantId);
      const files = filesForDocument(doc.id, doc.storedFilename);
      for (const f of files) {
        stats.found++;
        try {
          if (isEnvelope(readHeader(f.path))) { stats.alreadyEnc++; continue; }
          if (!dek) { noKeyTenants.add(doc.tenantId); stats.skipped++; continue; }
          if (DRY_RUN) { stats.encrypted++; continue; }
          cleanupTmp(f.path);
          const plaintext = fs.readFileSync(f.path);
          if (isEnvelope(plaintext)) { stats.alreadyEnc++; continue; } // garde-fou
          atomicWrite(f.path, encodeEnvelope(doc.tenantId, dek, plaintext));
          stats.encrypted++;
        } catch (e) {
          stats.errors++;
          if (!QUIET) console.error(`   ⚠️  ${f.kind} doc#${doc.id} : ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    const details = {
      docsSansTenant: [...noTenantDocs].slice(0, 50),
      tenantsSansCle: [...noKeyTenants],
    };
    if (!DRY_RUN) {
      await client.query(
        `UPDATE encryption_migration_runs SET finished_at=now(), found=$2, already_encrypted=$3, encrypted=$4, skipped=$5, errors=$6, details=$7 WHERE id=$1`,
        [runId, stats.found, stats.alreadyEnc, stats.encrypted, stats.skipped, stats.errors, JSON.stringify(details)],
      );
    }

    console.log(`\n${DRY_RUN ? "[DRY-RUN] " : ""}Résumé :`);
    console.log(`   • Fichiers trouvés       : ${stats.found}`);
    console.log(`   • Déjà chiffrés          : ${stats.alreadyEnc}`);
    console.log(`   • ${DRY_RUN ? "À chiffrer" : "Chiffrés"}              : ${stats.encrypted}`);
    console.log(`   • Ignorés (sans clé)     : ${stats.skipped}`);
    console.log(`   • Erreurs                : ${stats.errors}`);
    if (noTenantDocs.size > 0) console.log(`   ⚠️  Documents sans tenant_id : ${noTenantDocs.size} (fichiers non chiffrés — lancez saas:attach-data).`);
    if (noKeyTenants.size > 0) console.log(`   ⚠️  Tenants sans DEK : ${[...noKeyTenants].join(", ")} (générez les clés via /admin/saas/encryption).`);
    console.log(DRY_RUN ? "\n✅ Simulation terminée (aucune écriture)." : "\n✅ Migration terminée.");
  } finally {
    await client.end();
  }
  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((e) => { console.error("❌ saas:encrypt-existing-files :", e instanceof Error ? e.message : String(e)); process.exit(1); });
