/**
 * Sauvegarde / restauration des données locales Gedify
 * (~/Library/Application Support/Gedify/). Exclut les volumes Docker lourds et
 * reproductibles (paperless/postgres/redis) ainsi que le cache.
 */
import { spawn } from "node:child_process";
import { rootDir } from "./config";

export function createBackup(destZip: string): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      "zip",
      ["-r", "-q", destZip, ".", "-x", "paperless/*", "postgres/*", "redis/*", "cache/*", "logs/*"],
      { cwd: rootDir() },
    );
    let err = "";
    child.stderr.on("data", (b: Buffer) => (err += b.toString()));
    child.on("error", (e) => resolve({ ok: false, message: e.message }));
    child.on("close", (code) =>
      resolve(code === 0
        ? { ok: true, message: `Sauvegarde créée : ${destZip}` }
        : { ok: false, message: err || `Échec de la sauvegarde (code ${code}).` }),
    );
  });
}

export function restoreBackup(srcZip: string): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const child = spawn("unzip", ["-o", "-q", srcZip, "-d", rootDir()]);
    let err = "";
    child.stderr.on("data", (b: Buffer) => (err += b.toString()));
    child.on("error", (e) => resolve({ ok: false, message: e.message }));
    child.on("close", (code) =>
      resolve(code === 0
        ? { ok: true, message: "Sauvegarde restaurée. Redémarrez Gedify pour recharger les données." }
        : { ok: false, message: err || `Échec de la restauration (code ${code}).` }),
    );
  });
}
