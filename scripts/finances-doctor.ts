/* Maintenance FINANCES PUR-DISQUE (Partie 11). Sans deps natives, sans tsx.
   100 % LECTURE SEULE — n'écrit, ne supprime, ne modifie aucune ligne.

   inspect (défaut)     : synthèse (à contrôler, sans document, sans échéance,
                          en retard, créées IA, validées, doublons).
   --detect-duplicates  : liste les groupes de doublons probables (ids).
   --json               : sortie JSON (supervision). */

import { loadArray, dataDir } from "./_shared";

type Item = {
  id?: string;
  sourceDocumentId?: number | null;
  kind?: string;
  direction?: "incoming" | "outgoing" | "neutral";
  amount?: number;
  dueDate?: string | null;
  status?: string;
  validationStatus?: string;
  isAiDetected?: boolean;
  correspondentId?: number | null;
  label?: string;
};

const PAID_LIKE = new Set(["paid", "cancelled", "ignored"]);

function isOverdue(it: Item, todayIso: string): boolean {
  if (it.status === "overdue") return true;
  if (!it.dueDate) return false;
  if (it.status && PAID_LIKE.has(it.status)) return false;
  return it.dueDate.slice(0, 10) < todayIso;
}

function dupKey(it: Item): string {
  return `${it.sourceDocumentId ?? "x"}|${it.kind ?? ""}|${it.amount ?? 0}|${it.dueDate ?? ""}|${it.correspondentId ?? ""}`;
}

function main() {
  const argv = process.argv;
  const root = dataDir();
  const items = loadArray<Item>(root, "financial-items.json");
  const todayIso = new Date().toISOString().slice(0, 10);

  const groups = new Map<string, Item[]>();
  let toReview = 0, withoutDocument = 0, withoutDueDate = 0, overdue = 0, aiCreated = 0, validated = 0;
  for (const it of items) {
    if (it.validationStatus === "needs_review" || it.status === "to_review" || it.status === "suggested") toReview += 1;
    if (it.sourceDocumentId == null) withoutDocument += 1;
    if (it.direction === "outgoing" && !it.dueDate) withoutDueDate += 1;
    if (isOverdue(it, todayIso)) overdue += 1;
    if (it.isAiDetected) aiCreated += 1;
    if (it.validationStatus === "validated" || it.status === "validated") validated += 1;
    const k = dupKey(it);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(it);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);

  const report = {
    dataDir: root,
    total: items.length,
    toReview,
    withoutDocument,
    withoutDueDate,
    overdue,
    aiCreated,
    validated,
    duplicateGroups: dupGroups.length,
  };

  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (argv.includes("--detect-duplicates")) {
    console.log(`\n💶 Doublons probables : ${dupGroups.length} groupe(s)`);
    for (const g of dupGroups.slice(0, 50)) {
      const f = g[0];
      console.log(`  ${g.length}× · ${f.amount ?? "?"} € · ${f.kind ?? ""} · éch. ${f.dueDate ?? "—"} · doc ${f.sourceDocumentId ?? "—"}`);
      console.log(`      ids: ${g.map((x) => x.id ?? "?").join(", ")}`);
    }
    console.log("\nℹ️  Vérifiez avant toute fusion/suppression (gérée via l'UI Finances).\n");
    return;
  }

  console.log(`\n💶 Finances — ${root}`);
  console.log(`📊 Lignes budget : ${report.total}\n`);
  console.log("── À traiter ──");
  console.log(`  à contrôler         : ${toReview}`);
  console.log(`  en retard           : ${overdue}`);
  console.log(`  sans document lié   : ${withoutDocument}`);
  console.log(`  sans échéance (sort): ${withoutDueDate}`);
  console.log("\n── Provenance / état ──");
  console.log(`  créées par IA       : ${aiCreated}`);
  console.log(`  validées            : ${validated}`);
  console.log(`  doublons possibles  : ${dupGroups.length} groupe(s)`);
  console.log("\nℹ️  Options : --detect-duplicates · --json   (100 % lecture seule)\n");
}

main();
