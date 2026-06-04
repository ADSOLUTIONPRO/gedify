/* Maintenance CLASSEMENT PUR-DISQUE (Partie 5). Sans deps natives. Non destructif
   par defaut (la suppression/fusion se fait via l'UI, qui gere json ET postgres).

   - inspect (défaut)        : sans tag/type/correspondant/dossier, à vérifier,
                               tags/types inutilisés, dossiers vides, doublons corr.
   - --tags                  : liste les tags inutilisés.
   - --correspondents        : liste les correspondants doublons probables.
   - --apply-safe [--dry-run]: enfile un job IA pour les docs OCRisés sans type
                               ni correspondant (classement assisté en arrière-plan). */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir, loadArray } from "./_shared";

type Doc = { id?: number; content?: string; deleted?: boolean; tags?: number[]; document_type?: number | null; correspondent?: number | null; needs_review_reason?: string | null };
type Named = { id?: number; name?: string };
type Folder = { id?: string; parentId?: string | null; linkedDocumentIds?: number[] };

function norm(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

type Job = { id: string; type: string; documentId: number; payload: null; status: string; priority: number; attempts: number; maxAttempts: number; lastError: null; createdAt: string; startedAt: null; finishedAt: null };
function jobsFile(root: string) { return path.join(root, "jobs", "pipeline-jobs.json"); }
function readJobs(root: string): Job[] { try { const p = JSON.parse(readFileSync(jobsFile(root), "utf8")); return Array.isArray(p) ? p : []; } catch { return []; } }
function writeJobs(root: string, jobs: Job[]) { const f = jobsFile(root); mkdirSync(path.dirname(f), { recursive: true }); const tmp = `${f}.tmp-${process.pid}-${Date.now()}`; writeFileSync(tmp, JSON.stringify(jobs, null, 2), "utf8"); renameSync(tmp, f); }
function enqueue(jobs: Job[], type: string, documentId: number, priority: number): boolean {
  if (jobs.some((j) => j.type === type && j.documentId === documentId && (j.status === "pending" || j.status === "processing"))) return false;
  jobs.push({ id: randomUUID(), type, documentId, payload: null, status: "pending", priority, attempts: 0, maxAttempts: 3, lastError: null, createdAt: new Date().toISOString(), startedAt: null, finishedAt: null });
  return true;
}

function main() {
  const argv = process.argv;
  const root = dataDir();
  const docs = loadArray<Doc>(root, "documents.json").filter((d) => !d.deleted);
  const tags = loadArray<Named>(root, "tags.json");
  const types = loadArray<Named>(root, "document_types.json");
  const correspondents = loadArray<Named>(root, "correspondents.json");
  const folders = loadArray<Folder>(root, "project-folders.json");

  const inFolder = new Set<number>();
  for (const f of folders) for (const id of f.linkedDocumentIds ?? []) inFolder.add(Number(id));
  const usedTags = new Set<number>(); const usedTypes = new Set<number>();
  let wTag = 0, wType = 0, wCorr = 0, wFolder = 0, review = 0;
  for (const d of docs) {
    if (!(d.tags?.length)) wTag += 1; else for (const t of d.tags) usedTags.add(t);
    if (d.document_type == null) wType += 1; else usedTypes.add(d.document_type);
    if (d.correspondent == null) wCorr += 1;
    if (typeof d.id === "number" && !inFolder.has(d.id)) wFolder += 1;
    if (d.needs_review_reason) review += 1;
  }
  const unusedTags = tags.filter((t) => typeof t.id === "number" && !usedTags.has(t.id));
  const unusedTypes = types.filter((t) => typeof t.id === "number" && !usedTypes.has(t.id));
  const parentIds = new Set(folders.map((f) => f.parentId).filter(Boolean));
  const emptyFolders = folders.filter((f) => (f.linkedDocumentIds?.length ?? 0) === 0 && f.id && !parentIds.has(f.id));
  const byNorm = new Map<string, Named[]>();
  for (const c of correspondents) { const n = norm(c.name ?? ""); if (n.length < 2) continue; (byNorm.get(n) ?? byNorm.set(n, []).get(n)!).push(c); }
  const dupCorr = [...byNorm.values()].filter((a) => a.length > 1);

  if (argv.includes("--tags")) {
    console.log(`\n🏷️  Tags inutilisés : ${unusedTags.length}`);
    for (const t of unusedTags.slice(0, 50)) console.log(`  #${t.id} ${t.name ?? ""}`);
    console.log("\nℹ️  Supprimez-les depuis /tags (gère JSON et PostgreSQL).\n");
    return;
  }
  if (argv.includes("--correspondents")) {
    console.log(`\n👥 Correspondants doublons probables : ${dupCorr.length} groupe(s)`);
    for (const g of dupCorr.slice(0, 50)) console.log(`  ${g.map((c) => `#${c.id} ${c.name ?? ""}`).join("  ·  ")}`);
    console.log("\nℹ️  Fusionnez-les depuis /correspondants.\n");
    return;
  }
  if (argv.includes("--apply-safe")) {
    const dry = argv.includes("--dry-run");
    const targets = docs.filter((d) => typeof d.id === "number" && (d.content ?? "").trim() && (d.document_type == null || d.correspondent == null));
    if (dry) {
      console.log(`\n🧪 Dry-run : ${targets.length} document(s) OCRisés sans type/correspondant seraient analysés par l'IA.\n`);
      return;
    }
    const jobs = readJobs(root); let queued = 0;
    for (const d of targets) if (enqueue(jobs, "ai", d.id as number, 70)) queued += 1;
    writeJobs(root, jobs);
    console.log(`\n🧰 ${queued} job(s) IA mis en file (classement assisté) — worker en arrière-plan.\n`);
    return;
  }

  console.log(`\n📂 Data-dir : ${root}`);
  console.log(`📄 Documents : ${docs.length}\n`);
  console.log("── À classer ──");
  console.log(`  sans tag          : ${wTag}`);
  console.log(`  sans type         : ${wType}`);
  console.log(`  sans correspondant: ${wCorr}`);
  console.log(`  sans dossier      : ${wFolder}`);
  console.log(`  à vérifier        : ${review}`);
  console.log("\n── Taxonomies ──");
  console.log(`  tags inutilisés       : ${unusedTags.length} / ${tags.length}`);
  console.log(`  types inutilisés      : ${unusedTypes.length} / ${types.length}`);
  console.log(`  dossiers vides        : ${emptyFolders.length} / ${folders.length}`);
  console.log(`  correspondants doublons: ${dupCorr.length} groupe(s)`);
  console.log("\nℹ️  Options : --tags · --correspondents · --apply-safe [--dry-run]\n");
}

main();
