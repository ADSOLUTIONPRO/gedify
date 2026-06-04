/* Vérification de SAUVEGARDE & RESTORE DRY-RUN (Partie 8). Sans tsx runtime.
   100 % LECTURE SEULE — n'écrit, ne restaure, ne supprime JAMAIS rien.

   Lit les archives gedify-backup-*.zip / gedify-export-*.zip dans BACKUPS_DIR
   (ou <DATA_DIR>/backups) et valide leur structure via JSZip (sans extraction).

   Usage :
     (défaut)            : liste les sauvegardes (taille, date).
     --verify            : valide l'archive la plus récente (ou --file=NOM).
     --dry-run           : simule une restauration (ce qui SERAIT importé) sans
                           rien écrire.
     --file=NOM.zip      : cible une archive précise.
     --json              : sortie JSON (supervision).

   Sécurité : signale tout fichier sensible (tokens) qui aurait fui dans l'archive
   (les exports doivent être expurgés). N'affiche jamais de contenu de token. */

import { readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { dataDir } from "./_shared";

type Manifest = {
  format?: string;
  version?: number;
  app?: string;
  exportedAt?: string;
  includeFiles?: boolean;
  secretsRedacted?: boolean;
  counts?: Record<string, unknown>;
};

type Backup = { name: string; bytes: number; mtime: string };

const SECRET_RE = /gmail-tokens|access_token|refresh_token|\.pem$|client[_-]?secret|private[_-]?key/i;

function backupsDir(): string {
  return process.env.BACKUPS_DIR?.trim() || path.join(dataDir(), "backups");
}

function listBackups(dir: string): Backup[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith(".zip"))
    .map((n) => {
      const st = statSync(path.join(dir, n));
      return { name: n, bytes: st.size, mtime: new Date(st.mtimeMs).toISOString() };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function flag(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function fmtBytes(n: number): string {
  const u = ["o", "Ko", "Mo", "Go", "To"];
  if (!n) return "0 o";
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

async function inspect(dir: string, name: string) {
  const full = path.join(dir, name);
  const zip = await JSZip.loadAsync(readFileSync(full));
  const entries = Object.keys(zip.files).filter((k) => !zip.files[k].dir);

  const manifestEntry = zip.file("manifest.json");
  let manifest: Manifest | null = null;
  if (manifestEntry) {
    try {
      manifest = JSON.parse(await manifestEntry.async("string")) as Manifest;
    } catch {
      manifest = null;
    }
  }

  let documents: number | null = null;
  const docIndex = zip.file("documents/index.json");
  if (docIndex) {
    try {
      const arr = JSON.parse(await docIndex.async("string"));
      documents = Array.isArray(arr) ? arr.length : null;
    } catch {
      documents = null;
    }
  }

  const originals = entries.filter((k) => k.startsWith("documents/files/")).length;
  const taxonomies = ["correspondents", "tags", "document_types", "storage_paths", "custom_fields", "saved_views"].filter(
    (t) => zip.file(`taxonomies/${t}.json`),
  );
  const overlayFiles = entries.filter((k) => k.startsWith("data/")).length;

  let postgres: Record<string, number> | null = null;
  const pgDump = zip.file("postgres/dump.json");
  if (pgDump) {
    try {
      const parsed = JSON.parse(await pgDump.async("string")) as { counts?: Record<string, number> };
      postgres = parsed.counts ?? null;
    } catch {
      postgres = null;
    }
  }

  const leakedSecrets = entries.filter((k) => SECRET_RE.test(k));

  const problems: string[] = [];
  if (!manifest) problems.push("manifest.json absent ou illisible");
  else {
    if (manifest.format !== "gedify-export") problems.push(`format inattendu : ${manifest.format ?? "—"}`);
    if (manifest.version == null) problems.push("version absente du manifeste");
  }
  if (!docIndex) problems.push("documents/index.json absent");
  if (manifest?.includeFiles && originals === 0) problems.push("includeFiles=true mais aucun fichier original dans l'archive");
  if (leakedSecrets.length) problems.push(`${leakedSecrets.length} fichier(s) sensible(s) NON expurgé(s)`);

  return {
    file: name,
    bytes: statSync(full).size,
    manifest,
    documents,
    originals,
    taxonomies,
    overlayFiles,
    postgres,
    leakedSecrets,
    problems,
    status: problems.length ? "warning" : "ok",
  };
}

async function main() {
  const dir = backupsDir();
  const backups = listBackups(dir);
  const wantVerify = process.argv.includes("--verify");
  const wantDryRun = process.argv.includes("--dry-run");
  const asJson = process.argv.includes("--json");
  const target = flag("file") ?? backups[0]?.name ?? null;

  if (!wantVerify && !wantDryRun) {
    if (asJson) {
      console.log(JSON.stringify({ dir, backups }, null, 2));
      return;
    }
    console.log(`\n💾 Sauvegardes — ${dir}`);
    if (!backups.length) {
      console.log("  (aucune archive .zip trouvée)\n");
      return;
    }
    for (const b of backups) console.log(`  ${b.name}  ·  ${fmtBytes(b.bytes)}  ·  ${b.mtime}`);
    console.log(`\nℹ️  ${backups.length} archive(s). Options : --verify · --dry-run [--file=NOM] · --json\n`);
    return;
  }

  if (!target) {
    console.log(`\n⚠️  Aucune archive à analyser dans ${dir}\n`);
    process.exitCode = 1;
    return;
  }

  const r = await inspect(dir, target);

  if (asJson) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  if (wantDryRun) {
    console.log(`\n🧪 RESTORE DRY-RUN — ${r.file}  (aucune écriture)`);
    console.log("Une restauration importerait :");
    console.log(`  documents (métadonnées) : ${r.documents ?? "?"}`);
    console.log(`  fichiers originaux      : ${r.originals}`);
    console.log(`  taxonomies              : ${r.taxonomies.length} (${r.taxonomies.join(", ") || "—"})`);
    console.log(`  fichiers overlay (.data): ${r.overlayFiles}`);
    if (r.postgres) {
      const tables = Object.entries(r.postgres).map(([t, n]) => `${t}=${n}`).join(", ");
      console.log(`  dump PostgreSQL         : ${tables}`);
    }
    console.log(r.problems.length ? `\n⚠️  ${r.problems.length} problème(s) :` : "\n✅ Archive cohérente.");
    for (const p of r.problems) console.log(`  - ${p}`);
    console.log("\nℹ️  DRY-RUN : aucune donnée modifiée. Restauration réelle via Administration › Sauvegarde (import ZIP).\n");
    return;
  }

  // --verify
  console.log(`\n🔎 Vérification — ${r.file}  (${fmtBytes(r.bytes)})`);
  console.log(`  format/version : ${r.manifest?.format ?? "—"} v${r.manifest?.version ?? "?"}`);
  console.log(`  exporté le     : ${r.manifest?.exportedAt ?? "—"}`);
  console.log(`  documents      : ${r.documents ?? "?"}  ·  originaux : ${r.originals}`);
  console.log(`  taxonomies     : ${r.taxonomies.length}  ·  overlay : ${r.overlayFiles}`);
  console.log(`  secrets expurgés: ${r.manifest?.secretsRedacted ? "oui" : "non déclaré"}`);
  if (r.leakedSecrets.length) console.log(`  ⚠️ secrets fuités : ${r.leakedSecrets.length} fichier(s)`);
  console.log(`\nStatut : ${r.status === "ok" ? "✅ ok" : "⚠️ warning"}`);
  for (const p of r.problems) console.log(`  - ${p}`);
  console.log("");
  if (r.status !== "ok") process.exitCode = 1;
}

void main();
