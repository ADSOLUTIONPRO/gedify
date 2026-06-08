import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/storage/data-dir";
import { getStorageMode } from "@/lib/db/pg-store";

/* ────────────────────────────────────────────────────────────────────────
   Service de mises à jour — fondation IN-APP (détection d'environnement +
   vérification de version). L'EXÉCUTION d'une mise à jour (pull/recreate/
   migrate/rollback) est confiée au conteneur séparé « gedify-updater » via une
   API interne authentifiée — voir docs/updates.md. Ici : détection, état,
   vérification GHCR/manifeste, le tout sans accès Docker.
   ──────────────────────────────────────────────────────────────────────── */

export type DeploymentTarget = "coolify" | "synology" | "desktop" | "docker";
export type UpdateStrategy = "docker-agent" | "coolify-native" | "manual";

export type InstallationInfo = {
  runtime: "docker" | "desktop" | "node";
  deploymentTarget: DeploymentTarget;
  storageMode: "postgres" | "sqlite" | "json";
  architecture: string;
  updateStrategy: UpdateStrategy;
  updaterAvailable: boolean;
  label: string;
};

export type UpdateState = {
  installedVersion: string;
  latestVersion: string | null;
  latestDigest: string | null;
  releaseChannel: string;
  releaseNotesUrl: string | null;
  updateAvailable: boolean;
  compatibilityStatus: "ok" | "incompatible" | "unknown";
  lastCheckedAt: string | null;
  lastError: string | null;
};

const STATE_FILE = "update-state.json";
const INSTALLED_VERSION = process.env.GEDIFY_VERSION?.trim() || process.env.npm_package_version?.trim() || "0.1.0";
const IMAGE = "ghcr.io/adsolutionpro/gedify";

function normArch(): string {
  const a = process.arch;
  if (a === "x64") return "amd64";
  if (a === "arm64") return "arm64";
  return a;
}

/** Détection automatique du type d'installation (aucune saisie utilisateur). */
export function detectInstallation(): InstallationInfo {
  const explicit = process.env.GEDIFY_DEPLOYMENT_TARGET?.trim().toLowerCase() as DeploymentTarget | undefined;
  const storageMode = getStorageMode();
  const hasCoolify = Object.keys(process.env).some((k) => k.startsWith("COOLIFY"));
  const hasSynology = Boolean(process.env.SYNOLOGY_DOCKER_ROOT) || explicit === "synology";
  const isDesktop = process.env.GEDIFY_RUNTIME?.trim().toLowerCase() === "desktop" || explicit === "desktop";

  let deploymentTarget: DeploymentTarget;
  if (explicit && ["coolify", "synology", "desktop", "docker"].includes(explicit)) deploymentTarget = explicit;
  else if (hasCoolify) deploymentTarget = "coolify";
  else if (hasSynology) deploymentTarget = "synology";
  else if (isDesktop) deploymentTarget = "desktop";
  else deploymentTarget = "docker";

  const runtime: InstallationInfo["runtime"] = isDesktop ? "desktop" : "docker";
  const updaterAvailable = Boolean(process.env.GEDIFY_UPDATER_URL && process.env.GEDIFY_UPDATER_SECRET);
  const updateStrategy: UpdateStrategy = deploymentTarget === "desktop" ? "manual" : "docker-agent";

  const label =
    deploymentTarget === "coolify" ? "Serveur Coolify"
      : deploymentTarget === "synology" ? "Synology Container Manager"
        : deploymentTarget === "desktop" ? "Installation locale (desktop)"
          : "Installation Docker locale";

  return { runtime, deploymentTarget, storageMode, architecture: normArch(), updateStrategy, updaterAvailable, label };
}

function statePath() { return path.join(getDataDir(), STATE_FILE); }

async function readState(): Promise<UpdateState | null> {
  try {
    const raw = await readFile(statePath(), "utf8");
    return JSON.parse(raw) as UpdateState;
  } catch { return null; }
}

async function writeState(state: UpdateState): Promise<void> {
  const file = statePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function defaultState(): UpdateState {
  return {
    installedVersion: INSTALLED_VERSION, latestVersion: null, latestDigest: null,
    releaseChannel: process.env.GEDIFY_UPDATE_CHANNEL?.trim() || "stable",
    releaseNotesUrl: null, updateAvailable: false, compatibilityStatus: "unknown",
    lastCheckedAt: null, lastError: null,
  };
}

export async function getUpdateState(): Promise<UpdateState> {
  const s = await readState();
  return s ? { ...s, installedVersion: INSTALLED_VERSION } : defaultState();
}

/** Compare deux versions semver simplifiées (x.y.z). >0 si a>b. */
function cmpSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0); }
  return 0;
}

type Manifest = { version?: string; image?: string; digest?: string; releaseNotesUrl?: string; architectures?: string[] };

/**
 * Vérifie la dernière version : manifeste signé (GEDIFY_UPDATE_MANIFEST_URL) en
 * priorité, sinon la dernière release GitHub publique. Best-effort, jamais
 * bloquant ; n'exécute aucune migration ni opération Docker.
 */
export async function checkForUpdate(): Promise<UpdateState> {
  const arch = normArch();
  const channel = process.env.GEDIFY_UPDATE_CHANNEL?.trim() || "stable";
  const state: UpdateState = { ...(await getUpdateState()), releaseChannel: channel, lastCheckedAt: new Date().toISOString(), lastError: null };

  try {
    const manifestUrl = process.env.GEDIFY_UPDATE_MANIFEST_URL?.trim();
    if (manifestUrl) {
      const res = await fetch(manifestUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Manifeste HTTP ${res.status}`);
      const m = (await res.json()) as Manifest;
      state.latestVersion = m.version ?? null;
      state.latestDigest = m.digest ?? null;
      state.releaseNotesUrl = m.releaseNotesUrl ?? null;
      state.compatibilityStatus = m.architectures && !m.architectures.includes(arch) ? "incompatible" : "ok";
    } else {
      // Repli : dernière release GitHub publique.
      const res = await fetch("https://api.github.com/repos/adsolutionpro/gedify/releases/latest", {
        headers: { Accept: "application/vnd.github+json" }, cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const rel = (await res.json()) as { tag_name?: string; html_url?: string };
        state.latestVersion = rel.tag_name?.replace(/^v/, "") ?? null;
        state.releaseNotesUrl = rel.html_url ?? null;
        state.compatibilityStatus = "ok";
      } else if (res.status === 404) {
        state.latestVersion = null; // pas de release publiée
        state.compatibilityStatus = "unknown";
      } else {
        throw new Error(`GitHub HTTP ${res.status}`);
      }
    }
    state.updateAvailable = Boolean(state.latestVersion && cmpSemver(state.latestVersion, INSTALLED_VERSION) > 0 && state.compatibilityStatus !== "incompatible");
  } catch (e) {
    state.lastError = e instanceof Error ? e.message : String(e);
  }

  await writeState(state);
  return state;
}

export { IMAGE as GEDIFY_IMAGE };
