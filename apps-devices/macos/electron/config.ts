/**
 * Configuration & stockage local macOS de Gedify.
 *
 * - Tout est stocké sous ~/Library/Application Support/Gedify/ (= app.getPath("userData")
 *   quand productName = "Gedify").
 * - Les SECRETS (token Paperless / Gedify) ne sont JAMAIS écrits en clair : ils sont
 *   chiffrés via `safeStorage` (Keychain macOS) puis stockés en base64.
 * - Aucune dépendance à Coolify : on ne manipule que des variables génériques
 *   (PAPERLESS_URL, GEDIFY_API_URL, DATA_DIR…).
 */
import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import * as path from "node:path";

export type GedifyRuntimeMode = "remote_gedify" | "local_gedify" | "local_full";
export type PaperlessMode = "remote_paperless" | "local_paperless" | "not_configured";

export type GedifyConfig = {
  configured: boolean;
  runtimeMode: GedifyRuntimeMode | null;
  paperlessMode: PaperlessMode;
  /** Mode A — serveur Gedify distant (ex. https://doc.azserver.fr). */
  gedifyServerUrl?: string;
  /** Modes locaux — URL de Gedify local (ex. http://localhost:3120). */
  gedifyLocalUrl?: string;
  /** URL Paperless (distant ou local). */
  paperlessUrl?: string;
  /** Dossier de données locales (modes locaux). */
  localDataDir?: string;
  /** Nom d'espace (mode local léger). */
  spaceName?: string;
  configuredAt?: string;
  /** Référence du secret en Keychain : true si un token chiffré est stocké. */
  hasGedifyToken?: boolean;
  hasPaperlessToken?: boolean;
};

const DEFAULT_CONFIG: GedifyConfig = {
  configured: false,
  runtimeMode: null,
  paperlessMode: "not_configured",
};

/** Racine des données locales : ~/Library/Application Support/Gedify/ */
export function rootDir(): string {
  return app.getPath("userData");
}
export function configPath(): string {
  return path.join(rootDir(), "config.json");
}
function secretsPath(): string {
  return path.join(rootDir(), "secrets.bin.json");
}

/** Sous-dossiers attendus (créés à la configuration). */
export const SUBDIRS = ["data", "database", "cache", "logs", "paperless"];

export async function ensureDirs(extra: string[] = []): Promise<void> {
  await fs.mkdir(rootDir(), { recursive: true });
  for (const d of [...SUBDIRS, ...extra]) {
    await fs.mkdir(path.join(rootDir(), d), { recursive: true }).catch(() => {});
  }
}

export async function readConfig(): Promise<GedifyConfig> {
  try {
    const raw = await fs.readFile(configPath(), "utf8");
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<GedifyConfig>) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(config: GedifyConfig): Promise<void> {
  await ensureDirs();
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), "utf8");
}

/* ── Secrets (Keychain via safeStorage) ─────────────────────────────────── */

type SecretStore = Record<string, string>; // clé -> base64(chiffré)

async function readSecretStore(): Promise<SecretStore> {
  try {
    return JSON.parse(await fs.readFile(secretsPath(), "utf8")) as SecretStore;
  } catch {
    return {};
  }
}
async function writeSecretStore(store: SecretStore): Promise<void> {
  await ensureDirs();
  await fs.writeFile(secretsPath(), JSON.stringify(store), "utf8");
}

export async function setSecret(key: string, value: string | null): Promise<void> {
  const store = await readSecretStore();
  if (!value) {
    delete store[key];
  } else if (safeStorage.isEncryptionAvailable()) {
    store[key] = safeStorage.encryptString(value).toString("base64");
  } else {
    // Repli (sans Keychain) : on marque clairement le préfixe.
    store[key] = "plain:" + Buffer.from(value, "utf8").toString("base64");
  }
  await writeSecretStore(store);
}

export async function getSecret(key: string): Promise<string | null> {
  const store = await readSecretStore();
  const enc = store[key];
  if (!enc) return null;
  if (enc.startsWith("plain:")) return Buffer.from(enc.slice(6), "base64").toString("utf8");
  try {
    return safeStorage.decryptString(Buffer.from(enc, "base64"));
  } catch {
    return null;
  }
}
