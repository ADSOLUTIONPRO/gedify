/**
 * Lance le moteur Gedify local (build Next.js standalone) dans un process Node,
 * en réutilisant le binaire Electron en mode Node (ELECTRON_RUN_AS_NODE=1) — pas
 * besoin d'installer Node sur la machine de l'utilisateur.
 *
 * Auth désactivée (GEDIFY_LOCAL_NO_AUTH=1) : app mono-utilisateur sur localhost.
 * Données dans ~/Library/Application Support/Gedify/data. Paperless = URL fournie.
 */
import { app } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { getSecret, rootDir } from "./config";

let proc: ChildProcess | null = null;

export function runtimeDir(): string {
  const packaged = path.join(process.resourcesPath ?? "", "gedify-runtime");
  if (process.resourcesPath && fs.existsSync(packaged)) return packaged;
  return path.join(app.getAppPath(), "gedify-runtime");
}

export function runtimeAvailable(): boolean {
  return fs.existsSync(path.join(runtimeDir(), "server.js"));
}

export function isRunning(): boolean {
  return proc !== null && proc.exitCode === null;
}

async function waitForReady(port: number, timeoutMs = 40000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) });
      if (r.status < 500) return;
    } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error("Le moteur Gedify local n'a pas démarré dans le délai imparti.");
}

export async function startGedifyRuntime(opts: {
  port: number;
  paperlessUrl: string;
  paperlessToken?: string | null;
}): Promise<void> {
  if (isRunning()) return;
  const server = path.join(runtimeDir(), "server.js");
  if (!fs.existsSync(server)) {
    throw new Error("Moteur Gedify local absent. Build requis : apps-devices/macos/scripts/build-runtime.sh");
  }

  const dataDir = path.join(rootDir(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, "mail-connector"), { recursive: true });

  const pUrl = opts.paperlessUrl.replace(/\/+$/, "");
  const token = opts.paperlessToken ?? (await getSecret("paperless_token")) ?? "";

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(opts.port),
    HOSTNAME: "127.0.0.1",
    // Persistance locale
    DATA_DIR: dataDir,
    APP_DATA_DIR: dataDir,
    MAIL_CONNECTOR_DATA_DIR: path.join(dataDir, "mail-connector"),
    // Auth bureau local
    GEDIFY_LOCAL_NO_AUTH: "1",
    AUTH_SECRET: process.env.AUTH_SECRET ?? "gedify-local-desktop",
    // Paperless (local ou distant)
    PAPERLESS_URL: pUrl,
    PAPERLESS_BASE_URL: pUrl,
    PAPERLESS_API_URL: pUrl + "/api",
    PAPERLESS_TOKEN: token,
    // URLs publiques locales
    APP_URL: `http://localhost:${opts.port}`,
    NEXT_PUBLIC_APP_URL: `http://localhost:${opts.port}`,
  };

  proc = spawn(process.execPath, [server], { cwd: runtimeDir(), env });
  proc.stdout?.on("data", (b: Buffer) => console.log("[gedify-local]", b.toString().trimEnd()));
  proc.stderr?.on("data", (b: Buffer) => console.error("[gedify-local]", b.toString().trimEnd()));
  proc.on("exit", (code) => { console.log(`[gedify-local] arrêté (code ${code})`); proc = null; });

  await waitForReady(opts.port);
}

export function stopGedifyRuntime(): void {
  if (proc) { proc.kill(); proc = null; }
}
