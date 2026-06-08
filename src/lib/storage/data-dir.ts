import "server-only";

import fs from "node:fs";
import path from "node:path";
import { ensureGedStorage } from "./ged-paths";

/**
 * Répertoire de données UNIQUE et PERSISTANT de la surcouche Gedify.
 *
 * Toutes les données créées depuis l'interface (dossiers/projets, budget, notes,
 * signatures, résultats IA, modèles appris, liens mails/documents…) DOIVENT être
 * stockées ici, jamais dans un chemin éphémère du conteneur (build, /app/src…).
 *
 * Résolution (dans l'ordre) :
 *   1. process.env.DATA_DIR
 *   2. process.env.APP_DATA_DIR
 *   3. <cwd>/.data  (→ /app/.data dans le conteneur ; à monter sur un volume Coolify)
 *
 * Une migration unique recopie les anciens emplacements (.ged-azserver, data/)
 * vers ce répertoire sans écraser les données plus récentes.
 */

let resolvedRootCache: string | null = null;

/** Vrai si `dir` peut être créé ET écrit (test réel, créé si besoin). */
function canCreateAndWrite(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Racine des données. Priorité : DATA_DIR → APP_DATA_DIR → <cwd>/.data.
 * SÉCURITÉ ROBUSTESSE : si le chemin configuré n'est pas créable/écrivable
 * (ex. DATA_DIR=/app/.data hérité du conteneur mais lancé en local macOS où
 * « /app » n'existe pas), on retombe sur <cwd>/.data plutôt que de faire
 * échouer silencieusement toutes les écritures JSON. Sur le serveur (Docker),
 * /app/.data est écrivable → aucun repli.
 */
function resolveRoot(): string {
  if (resolvedRootCache) return resolvedRootCache;
  const fallback = path.join(process.cwd(), ".data");
  const configured = (process.env.DATA_DIR ?? process.env.APP_DATA_DIR ?? "").trim();
  if (!configured) { resolvedRootCache = fallback; return fallback; }
  if (canCreateAndWrite(configured)) { resolvedRootCache = configured; return configured; }
  console.warn(`[DATA_DIR] « ${configured} » non créable/écrivable → repli sur « ${fallback} ».`);
  resolvedRootCache = fallback;
  return fallback;
}

/** Anciens répertoires racine (relatifs au cwd) à migrer vers le nouveau. */
const LEGACY_ROOTS = [".ged-azserver", "data"];

let migrated = false;

/** Copie récursive src→dest sans écraser un fichier de destination plus récent. */
function copyNoOverwrite(src: string, dest: string): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyNoOverwrite(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  // Fichier : copier si absent OU si la source est plus récente.
  let destNewer = false;
  try {
    const ds = fs.statSync(dest);
    destNewer = ds.mtimeMs >= stat.mtimeMs;
  } catch {
    destNewer = false; // destination absente → on copie
  }
  if (!destNewer) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function countProjects(root: string): number {
  try {
    const raw = fs.readFileSync(path.join(root, "project-folders.json"), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function migrateOnce(root: string): void {
  if (migrated) return;
  migrated = true;
  try {
    fs.mkdirSync(root, { recursive: true });
    const rootResolved = path.resolve(root);
    for (const legacy of LEGACY_ROOTS) {
      const abs = path.join(process.cwd(), legacy);
      if (!fs.existsSync(abs)) continue;
      if (path.resolve(abs) === rootResolved) continue;
      try {
        copyNoOverwrite(abs, root);
      } catch (e) {
        console.error(`[DATA_DIR] migration ${legacy} → ${root} échouée :`, e instanceof Error ? e.message : e);
      }
    }
    // ── Logs de démarrage (§4) ──
    const files = fs.existsSync(root)
      ? fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isFile() && d.name.endsWith(".json")).map((d) => d.name)
      : [];
    console.log(`[DATA_DIR] répertoire de données : ${root}`);
    console.log(`[DATA_DIR] fichiers de stockage JSON détectés (${files.length}) : ${files.slice(0, 40).join(", ") || "aucun"}`);
    console.log(`[DATA_DIR] dossiers/projets chargés : ${countProjects(root)}`);

    // ── Test d'écriture : révèle un volume non inscriptible (permissions) ──
    try {
      const probe = path.join(root, ".write-test");
      fs.writeFileSync(probe, String(Date.now()));
      fs.unlinkSync(probe);
      console.log(`[DATA_DIR] écriture OK — les données seront persistées dans ${root}`);
    } catch (e) {
      console.error(
        `[DATA_DIR] ⚠️ ÉCRITURE IMPOSSIBLE dans ${root} (${e instanceof Error ? e.message : e}). ` +
        `Les données NE SERONT PAS persistées. Vérifiez que le volume Coolify est monté sur ce chemin ` +
        `et qu'il appartient à l'utilisateur applicatif (chown -R 1001:1001 ${root}).`,
      );
    }

    // ── Arborescence fichiers GED (files/, ocr/, ai/, cache/, logs/, backups/) ──
    try {
      ensureGedStorage();
    } catch (e) {
      console.error("[DATA_DIR] création de l'arborescence GED échouée :", e instanceof Error ? e.message : e);
    }
  } catch (e) {
    console.error("[DATA_DIR] initialisation du répertoire de données échouée :", e instanceof Error ? e.message : e);
  }
}

/** Répertoire racine persistant des données Gedify (migration garantie au 1er appel). */
export function getDataDir(): string {
  const root = resolveRoot();
  migrateOnce(root);
  return root;
}

/** Sous-répertoire dédié (budget, ai, actions, writer, signatures, mail-connector…). */
export function getDataSubdir(name: string): string {
  return path.join(getDataDir(), name);
}
