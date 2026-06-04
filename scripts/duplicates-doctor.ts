/* gedify:duplicates:inspect — Détection de doublons PUR-DISQUE.

   Lit engine/documents.json et liste les groupes de doublons exacts (même hash)
   et probables (nom + nombre de pages très proches). Lecture seule, ne supprime
   rien. */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./_shared";

type Doc = {
  id?: number;
  title?: string;
  original_file_name?: string | null;
  checksum?: string;
  page_count?: number | null;
  deleted?: boolean;
};

function normTitle(d: Doc): string {
  return (d.original_file_name ?? d.title ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function main() {
  const root = dataDir();
  const file = path.join(root, "engine", "documents.json");
  let docs: Doc[] = [];
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
      docs = Array.isArray(parsed) ? (parsed as Doc[]) : [];
    } catch {
      docs = [];
    }
  }
  docs = docs.filter((d) => !d.deleted);

  const byHash = new Map<string, Doc[]>();
  for (const d of docs) {
    if (!d.checksum) continue;
    const a = byHash.get(d.checksum) ?? [];
    a.push(d);
    byHash.set(d.checksum, a);
  }
  const exact: Doc[][] = [...byHash.values()].filter((a) => a.length > 1);
  const exactIds = new Set(exact.flat().map((d) => d.id));

  const byKey = new Map<string, Doc[]>();
  for (const d of docs) {
    if (exactIds.has(d.id)) continue;
    const t = normTitle(d);
    if (t.length < 3) continue;
    const key = `${t}|${d.page_count ?? "?"}`;
    const a = byKey.get(key) ?? [];
    a.push(d);
    byKey.set(key, a);
  }
  const probable: Doc[][] = [...byKey.values()].filter((a) => a.length > 1);

  console.log(`\n📂 Data-dir : ${root}`);
  console.log(`📄 Documents actifs : ${docs.length}\n`);
  console.log(`── Doublons exacts (même empreinte) : ${exact.length} groupe(s) ──`);
  for (const g of exact.slice(0, 30)) {
    console.log(`  ${g.map((d) => `#${d.id}`).join(", ")} — ${g[0].title ?? ""}`);
  }
  console.log(`\n── Doublons probables (nom + pages proches) : ${probable.length} groupe(s) ──`);
  for (const g of probable.slice(0, 30)) {
    console.log(`  ${g.map((d) => `#${d.id}`).join(", ")} — ${g[0].title ?? ""}`);
  }
  console.log("");
}

main();
