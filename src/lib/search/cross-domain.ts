import "server-only";

import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { listMailDocumentLinks } from "@/lib/messaging/mail-document-links-store";
import { listEmailLinks } from "@/lib/messaging/email-ged-link-store";

/* ────────────────────────────────────────────────────────────────────────
   Filtres de recherche TRANSVERSES (Chantier recherche avancée).

   Le moteur documentaire ne connaît ni le budget ni les mails. On résout donc
   ici l'ensemble des `documentId` qui satisfont des critères transverses
   (montant / échéance d'une ligne budget liée, présence d'un mail lié), puis on
   passe cet ensemble au moteur via `id__in`. Couche orchestration (la page),
   pas de dépendance croisée dans le moteur.
   ──────────────────────────────────────────────────────────────────────── */

export type CrossDomainFilters = {
  amountMin?: number | null;
  amountMax?: number | null;
  dueFrom?: string | null; // YYYY-MM-DD
  dueTo?: string | null;
  hasMail?: boolean;
};

export function hasCrossDomainFilters(f: CrossDomainFilters): boolean {
  return (
    f.amountMin != null ||
    f.amountMax != null ||
    Boolean(f.dueFrom) ||
    Boolean(f.dueTo) ||
    Boolean(f.hasMail)
  );
}

async function budgetDocumentIds(f: CrossDomainFilters): Promise<Set<number>> {
  const items = await listFinancialItems();
  const ids = new Set<number>();
  for (const it of items) {
    if (it.sourceDocumentId == null) continue;
    if (f.amountMin != null && !(it.amount >= f.amountMin)) continue;
    if (f.amountMax != null && !(it.amount <= f.amountMax)) continue;
    if (f.dueFrom && !(it.dueDate && it.dueDate >= f.dueFrom)) continue;
    if (f.dueTo && !(it.dueDate && it.dueDate <= f.dueTo)) continue;
    ids.add(it.sourceDocumentId);
  }
  return ids;
}

async function mailDocumentIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  const [links, gedLinks] = await Promise.all([
    listMailDocumentLinks().catch(() => []),
    listEmailLinks().catch(() => []),
  ]);
  for (const l of links) if (l.paperlessDocumentId != null) ids.add(l.paperlessDocumentId);
  for (const l of gedLinks) {
    if (l.target?.kind === "document" && typeof l.target.documentId === "number") {
      ids.add(l.target.documentId);
    }
  }
  return ids;
}

/**
 * Résout l'ensemble des documentIds satisfaisant les filtres transverses ACTIFS
 * (intersection entre catégories actives). Renvoie :
 *  - null  si aucun filtre transverse → pas de restriction,
 *  - []    si filtres actifs mais aucun document → résultat vide.
 */
export async function resolveCrossDomainDocumentIds(
  f: CrossDomainFilters,
): Promise<number[] | null> {
  if (!hasCrossDomainFilters(f)) return null;

  const budgetActive = f.amountMin != null || f.amountMax != null || Boolean(f.dueFrom) || Boolean(f.dueTo);
  const sets: Set<number>[] = [];
  if (budgetActive) sets.push(await budgetDocumentIds(f));
  if (f.hasMail) sets.push(await mailDocumentIds());

  if (sets.length === 0) return null;
  // Intersection des ensembles actifs.
  let result = sets[0];
  for (let i = 1; i < sets.length; i += 1) {
    result = new Set([...result].filter((id) => sets[i].has(id)));
  }
  return [...result];
}
