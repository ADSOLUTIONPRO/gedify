import "server-only";

import fs from "node:fs";
import path from "node:path";
import { getStorageMode } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Diagnostic de persistance (stockage + auth) — JAMAIS de valeur secrète.

   Sert à trois usages :
   • log de démarrage (`logStorageDiagnostic`, via instrumentation) → visible
     dans `docker logs gedify` ;
   • garde-fou anti-réinitialisation (`detectStorageAnomaly`) → empêche
     l'assistant « première installation » de s'afficher sur un NAS dont la base
     existante est introuvable (volume non monté / chemin modifié) ;
   • route/CLI de diagnostic admin (formes JSON sans secret).
   ──────────────────────────────────────────────────────────────────────── */

/** Secrets internes attendus (présence uniquement — jamais la valeur). */
const SECRET_KEYS = [
  "AUTH_SECRET",
  "SESSION_SECRET",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  "INTERNAL_API_KEY",
  "CRON_SECRET",
  "ONLYOFFICE_JWT_SECRET",
] as const;

/** Noms de bases SQLite historiques/erronés à détecter (jamais supprimés). */
const LEGACY_DB_NAMES = [
  "gedify.db",
  "database.sqlite",
  "dev.db",
  "data.sqlite",
  "prisma/dev.db",
];

export type StorageDiagnostic = {
  runtime: string;
  storageMode: "json" | "sqlite" | "postgres";
  dataDir: string;
  dataDirWritable: boolean;
  databasePath: string | null;
  databaseExists: boolean;
  databaseWritable: boolean;
  databaseSize: number;
  walSize: number;
  appliedMigrations: number;
  usersCount: number;
  dataPresent: boolean;
  legacyDbFiles: string[];
  secretsFileExists: boolean;
  secretsPresent: Record<string, boolean>;
  anomaly: boolean;
  anomalyReason: string | null;
};

function fileSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function isWritable(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Compte les utilisateurs SANS déclencher l'amorçage admin (lecture brute). */
async function countUsers(): Promise<number> {
  try {
    const { readStore, STORE } = await import("@/lib/engine/stores");
    const users = await readStore<unknown[]>(STORE.users, []);
    return Array.isArray(users) ? users.length : 0;
  } catch {
    return 0;
  }
}

export async function collectStorageDiagnostic(): Promise<StorageDiagnostic> {
  const mode = getStorageMode();
  const dataDir = getDataDir();

  let databasePath: string | null = null;
  let databaseExists = false;
  let databaseWritable = false;
  let databaseSize = 0;
  let walSize = 0;
  let appliedMigrations = 0;
  let dataPresent = false;

  if (mode === "sqlite") {
    try {
      const { resolveGedifyDatabaseUrl, sqliteHealth } = await import("@/lib/db/sqlite/client");
      databasePath = resolveGedifyDatabaseUrl();
      databaseExists = fs.existsSync(databasePath);
      databaseSize = fileSize(databasePath);
      walSize = fileSize(`${databasePath}-wal`);
      databaseWritable = databaseExists ? isWritable(databasePath) : isWritable(dataDir);
      try {
        const h = sqliteHealth();
        appliedMigrations = h.appliedMigrations;
        dataPresent = Object.values(h.counts).some((n) => n > 0);
      } catch {
        /* base illisible : laissé à false */
      }
    } catch {
      /* module sqlite indisponible */
    }
  } else if (mode === "json") {
    const engineDir = path.join(dataDir, "engine");
    databaseWritable = isWritable(dataDir);
    for (const f of ["documents.json", "tags.json", "correspondents.json"]) {
      if (fileSize(path.join(engineDir, f)) > 3) {
        dataPresent = true;
        break;
      }
    }
  } else {
    databaseWritable = isWritable(dataDir);
  }

  const legacyDbFiles = LEGACY_DB_NAMES
    .map((n) => path.join(dataDir, n))
    .filter((p) => fs.existsSync(p) && p !== databasePath);

  const usersCount = await countUsers();

  const secretsFile = path.join(dataDir, "secrets.env");
  const secretsFileExists = fs.existsSync(secretsFile);
  const secretsPresent: Record<string, boolean> = {};
  for (const k of SECRET_KEYS) secretsPresent[k] = Boolean(process.env[k]?.trim());

  // Anomalie : aucune entrée utilisateur ALORS QUE des signaux d'installation
  // existante sont présents → la base attendue est introuvable / le volume n'est
  // pas monté. On NE réinitialise rien : on signale.
  let anomaly = false;
  let anomalyReason: string | null = null;
  if (usersCount === 0) {
    if (legacyDbFiles.length > 0) {
      anomaly = true;
      anomalyReason = `Base SQLite héritée détectée (${legacyDbFiles
        .map((p) => path.basename(p))
        .join(", ")}) mais 0 utilisateur dans la base active (${databasePath ?? dataDir}).`;
    } else if (dataPresent) {
      anomaly = true;
      anomalyReason =
        "Des données existent (documents/tags/correspondants) mais aucun utilisateur — base d'authentification introuvable ou volume non monté au bon chemin.";
    }
  }

  return {
    runtime: `node ${process.version}`,
    storageMode: mode,
    dataDir,
    dataDirWritable: isWritable(dataDir),
    databasePath,
    databaseExists,
    databaseWritable,
    databaseSize,
    walSize,
    appliedMigrations,
    usersCount,
    dataPresent,
    legacyDbFiles,
    secretsFileExists,
    secretsPresent,
    anomaly,
    anomalyReason,
  };
}

/** Log de démarrage (sans secret). À appeler depuis l'instrumentation. */
export async function logStorageDiagnostic(): Promise<void> {
  try {
    const d = await collectStorageDiagnostic();
    console.log(`[storage] runtime=${d.runtime} mode=${d.storageMode}`);
    console.log(`[storage] dataDir=${d.dataDir} writable=${d.dataDirWritable}`);
    if (d.databasePath) {
      console.log(
        `[storage] databasePath=${d.databasePath} exists=${d.databaseExists} size=${d.databaseSize} wal=${d.walSize} writable=${d.databaseWritable} migrations=${d.appliedMigrations}`,
      );
    }
    console.log(`[auth] usersCount=${d.usersCount} dataPresent=${d.dataPresent}`);
    console.log(
      `[auth] secretsFile=${d.secretsFileExists} ` +
        SECRET_KEYS.map((k) => `${k}=${d.secretsPresent[k]}`).join(" "),
    );
    if (d.legacyDbFiles.length) {
      console.warn(`[storage] ⚠ bases héritées détectées (non supprimées) : ${d.legacyDbFiles.join(", ")}`);
    }
    if (d.anomaly) {
      console.error(`[storage] ⛔ ANOMALIE PERSISTANCE : ${d.anomalyReason}`);
      console.error("[storage] → vérifiez le montage du volume (ex. /volume5/docker/gedify/data:/app/.data). Aucune donnée n'a été supprimée.");
    }
  } catch (e) {
    console.error("[storage] diagnostic de démarrage échoué :", e instanceof Error ? e.message : e);
  }
}

/**
 * Retourne la raison d'anomalie si l'on doit BLOQUER l'assistant de première
 * installation (base existante introuvable), sinon `null`.
 *
 * Exception : si un admin d'amorçage est configuré par environnement
 * (`GEDIFY_ADMIN_USER` + `GEDIFY_ADMIN_PASSWORD`), on laisse la récupération
 * recréer le compte (les données restent intactes) au lieu de bloquer.
 */
export async function detectStorageAnomaly(): Promise<string | null> {
  const hasEnvAdmin = Boolean(process.env.GEDIFY_ADMIN_USER?.trim() && process.env.GEDIFY_ADMIN_PASSWORD);
  if (hasEnvAdmin) return null;
  const d = await collectStorageDiagnostic();
  return d.anomaly ? d.anomalyReason : null;
}
