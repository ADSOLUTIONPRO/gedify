/**
 * Détection macOS + téléchargement/installation de la BONNE version de Docker
 * Desktop (compatible avec la puce et la version de macOS).
 *
 * L'install copie Docker.app dans /Applications automatiquement ; restent les
 * étapes interactives imposées par Apple/Docker (1ʳᵉ ouverture : licence + mot
 * de passe admin pour le composant privilégié).
 *
 * Mapping VÉRIFIÉ (version + macOS minimum lus dans le .dmg lui-même) :
 *  macOS ≥ 14         → dernière version           (mac/main/<arch>/Docker.dmg)
 *  macOS 11, 12, 13   → 4.30.0  build 149282  (min macOS 11.0)
 *  macOS 10.13–10.15  → 4.3.2   build 72729   (min macOS 10.13, Intel uniquement)
 *  macOS < 10.13      → trop ancien (non garanti)
 */
import { app } from "electron";
import { spawn, exec } from "node:child_process";
import * as path from "node:path";

export type MacInfo = { arch: "arm64" | "amd64"; productVersion: string; major: number };

export function detectMac(): Promise<MacInfo> {
  return new Promise((resolve) => {
    exec("sw_vers -productVersion", (_e, stdout) => {
      const v = (stdout || "").trim() || "0";
      const major = parseInt(v.split(".")[0], 10) || 0;
      resolve({ arch: process.arch === "arm64" ? "arm64" : "amd64", productVersion: v, major });
    });
  });
}

const BASE = "https://desktop.docker.com/mac/main";

export function dockerChoice(info: MacInfo): { url: string; label: string; tooOld: boolean } {
  const arch = info.arch; // arm64 (Apple Silicon) ou amd64 (Intel)
  // macOS récent (14+) : dernière version.
  if (info.major >= 14) return { url: `${BASE}/${arch}/Docker.dmg`, label: "dernière version", tooOld: false };
  // macOS 11–13 : Docker 4.30.0 (min macOS 11.0, vérifié) — couvre Big Sur, Monterey, Ventura.
  if (info.major >= 11) return { url: `${BASE}/${arch}/149282/Docker.dmg`, label: "Docker 4.30.0 (compatible macOS 11 à 13)", tooOld: false };
  // macOS 10.13–10.15 (Intel uniquement) : Docker 4.3.2 (min macOS 10.13, vérifié).
  const v = parseFloat(info.productVersion.replace(/^10\./, "10.").split(".").slice(0, 2).join(".")) || 0; // ex 10.15 -> 10.15
  if (info.major === 10 && v >= 10.13) return { url: `${BASE}/amd64/72729/Docker.dmg`, label: "Docker 4.3.2 (compatible macOS 10.13 à 10.15)", tooOld: false };
  return { url: `${BASE}/amd64/72729/Docker.dmg`, label: "Docker 4.3.2 (ton macOS est antérieur à 10.13 — non garanti)", tooOld: true };
}

function run(cmd: string, args: string[]): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const c = spawn(cmd, args);
    let out = "";
    c.stdout.on("data", (b: Buffer) => (out += b.toString()));
    c.stderr.on("data", (b: Buffer) => (out += b.toString()));
    c.on("error", (e) => resolve({ code: 1, out: out + e.message }));
    c.on("close", (code) => resolve({ code, out }));
  });
}

/** Télécharge la bonne version puis installe Docker.app dans /Applications. */
export async function autoInstallDocker(): Promise<{ ok: boolean; message: string }> {
  const info = await detectMac();
  const choice = dockerChoice(info);
  const dmg = path.join(app.getPath("downloads"), "Docker.dmg");
  const mount = path.join(app.getPath("temp"), "gedify-docker-mnt");

  // 1) Téléchargement (le .dmg fait plusieurs centaines de Mo)
  const dl = await run("curl", ["-L", "-f", "-o", dmg, choice.url]);
  if (dl.code !== 0) return { ok: false, message: `Téléchargement de ${choice.label} échoué.\n${dl.out.slice(-400)}` };

  // 2) Montage + copie dans /Applications
  await run("hdiutil", ["detach", mount, "-force"]).catch(() => {});
  const att = await run("hdiutil", ["attach", dmg, "-nobrowse", "-mountpoint", mount]);
  if (att.code !== 0) { spawn("open", [dmg]); return { ok: true, message: `${choice.label} téléchargé. Glissez Docker dans Applications dans la fenêtre ouverte.` }; }

  const cp = await run("cp", ["-R", path.join(mount, "Docker.app"), "/Applications/"]);
  await run("hdiutil", ["detach", mount, "-force"]).catch(() => {});

  if (cp.code !== 0) {
    spawn("open", [dmg]);
    return { ok: true, message: `${choice.label} téléchargé. Copie auto impossible — glissez Docker dans Applications dans la fenêtre ouverte.` };
  }

  // 3) 1ʳᵉ ouverture (licence + mot de passe admin = étapes Apple/Docker inévitables)
  spawn("open", ["-a", "Docker"]);
  return {
    ok: true,
    message: `${choice.label} installée dans Applications (macOS ${info.productVersion}). Docker se lance : acceptez la licence + le mot de passe admin, puis revenez et cliquez « Vérifier Docker à nouveau ».`,
  };
}
