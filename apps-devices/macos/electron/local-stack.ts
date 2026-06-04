/**
 * Pilotage du stack Paperless local (mode « Gedify Local complète »).
 *
 * Première version : on délègue à des scripts shell (`local-stack/scripts/*.sh`) qui
 * utilisent `docker compose`. L'app vérifie Docker, lance/arrête/réinitialise le stack
 * et lit son état. L'orchestration fine (création du compte admin + token) reste pour
 * l'instant guidée manuellement (ouvrir http://localhost:8010), voir le README.
 */
import { app } from "electron";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fsSync from "node:fs";
import { rootDir } from "./config";

/** Dossier `local-stack` (extraResources en prod, dossier projet en dev). */
export function localStackDir(): string {
  const packaged = path.join(process.resourcesPath ?? "", "local-stack");
  if (process.resourcesPath && fsSync.existsSync(packaged)) return packaged;
  return path.join(app.getAppPath(), "local-stack");
}

export type RunResult = { ok: boolean; code: number | null; output: string };

/** Exécute un script du stack et renvoie sa sortie agrégée. */
export function runScript(name: string, env: Record<string, string> = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const script = path.join(localStackDir(), "scripts", name);
    const child = spawn("bash", [script], {
      cwd: localStackDir(),
      env: { ...process.env, GEDIFY_DATA_DIR: rootDir(), ...env },
    });
    let output = "";
    const collect = (b: Buffer) => { output += b.toString(); };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (e) => resolve({ ok: false, code: null, output: output + "\n" + e.message }));
    child.on("close", (code) => resolve({ ok: code === 0, code, output }));
  });
}

/** Vérifie la présence + disponibilité de Docker. */
export function checkDocker(): Promise<{ installed: boolean; running: boolean; message: string }> {
  return new Promise((resolve) => {
    const child = spawn("docker", ["info", "--format", "{{.ServerVersion}}"]);
    let out = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.stderr.on("data", (b) => (out += b.toString()));
    child.on("error", () =>
      resolve({ installed: false, running: false, message: "Docker n'est pas installé (commande `docker` introuvable)." }),
    );
    child.on("close", (code) => {
      if (code === 0) resolve({ installed: true, running: true, message: `Docker actif (v${out.trim()}).` });
      else resolve({ installed: true, running: false, message: "Docker est installé mais ne répond pas (Docker Desktop est-il lancé ?)." });
    });
  });
}

function readEnv(key: string): string | null {
  try {
    const env = fsSync.readFileSync(path.join(localStackDir(), ".env"), "utf8");
    const m = env.match(new RegExp("^" + key + "=(.*)$", "m"));
    return m ? m[1].trim() : null;
  } catch { return null; }
}

/** Récupère le token API Paperless local via le compte admin auto-créé (réessaie). */
export async function fetchPaperlessToken(port = 8010): Promise<{ ok: boolean; token?: string; message: string }> {
  const user = readEnv("PAPERLESS_ADMIN_USER") ?? "admin";
  const pass = readEnv("PAPERLESS_ADMIN_PASSWORD");
  if (!pass) return { ok: false, message: "Configuration Paperless introuvable (lancez l'installation d'abord)." };
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const d = (await res.json()) as { token?: string };
        if (d.token) return { ok: true, token: d.token, message: "Token Paperless récupéré." };
      }
    } catch { /* Paperless pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { ok: false, message: "Token Paperless non obtenu — Paperless n'est peut-être pas encore prêt." };
}

export const localStack = {
  install: () => runScript("install-local-stack.sh"),
  start: () => runScript("start-local-stack.sh"),
  stop: () => runScript("stop-local-stack.sh"),
  reset: () => runScript("reset-local-stack.sh"),
  status: () => runScript("status-local-stack.sh"),
};
