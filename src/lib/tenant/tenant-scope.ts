import "server-only";

import { isMultiTenantEnabled } from "./tenant-config";

export { isMultiTenantEnabled } from "./tenant-config";

/* ────────────────────────────────────────────────────────────────────────
   Périmètre multi-tenant des tables métier (Phase 2).

   Une table est « tenant-scopée » si elle porte une colonne `tenant_id`. Le
   filtrage/confinement par tenant n'est activé QUE si :
     • la table est dans TENANT_SCOPED_TABLES,
     • MULTI_TENANT est activé,
     • un tenant est résolu (contexte requête + utilisateur + membership).
   Sinon `activeTenantIdFor` renvoie `null` → comportement HISTORIQUE strict
   (aucun filtre, aucune colonne tenant_id touchée) → main/Synology/local et le
   mode mono-tenant restent inchangés. Mettre MULTI_TENANT=false suffit à tout
   désactiver instantanément (rollback).
   ──────────────────────────────────────────────────────────────────────── */

export const TENANT_SCOPED_TABLES = new Set<string>([
  "documents",
  "tags",
  "correspondents",
  "document_types",
  "folders",
  "document_correspondents",
]);

export function isTenantScopedTable(name: string): boolean {
  return TENANT_SCOPED_TABLES.has(name);
}

/**
 * Tenant actif pour une table donnée, ou `null` (→ comportement historique).
 * `null` si : table non scopée, MULTI_TENANT off, hors contexte requête (job de
 * fond) ou utilisateur/membership absent. Jamais d'exception.
 */
export async function activeTenantIdFor(table: string): Promise<string | null> {
  if (!isTenantScopedTable(table)) return null;
  if (!isMultiTenantEnabled()) return null;
  try {
    // Import dynamique → casse le cycle statique
    // (get-current-tenant → current-user → engine/stores → engine-pg → ce module).
    const { getActiveTenantId } = await import("./get-current-tenant");
    return await getActiveTenantId();
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────────
   Helpers de requêtes tenant — pour éviter de répéter `tenant_id` partout dans
   les routes/fonctions qui adoptent le scoping de façon explicite. Tous sont
   no-op si `tenantId` est null (mode mono-tenant / hors SaaS) → comportement
   inchangé.
   ──────────────────────────────────────────────────────────────────────── */

/** Clause `where` tenant pour une requête (Prisma-like) : `{ tenantId }` ou `{}`. */
export function getTenantWhere(tenantId: string | null): Record<string, unknown> {
  return tenantId ? { tenantId } : {};
}

/** Estampille un objet de données avec le tenant courant (no-op si null). */
export function withTenantId<T extends Record<string, unknown>>(
  data: T,
  tenantId: string | null,
): T & { tenantId?: string } {
  return tenantId ? { ...data, tenantId } : data;
}

/** Fusionne une clause `where` existante avec le filtre tenant (no-op si null). */
export function tenantScopedWhere<T extends Record<string, unknown>>(
  baseWhere: T,
  tenantId: string | null,
): T & { tenantId?: string } {
  return tenantId ? { ...baseWhere, tenantId } : baseWhere;
}

/**
 * Vérifie qu'un enregistrement appartient au tenant courant ; lève sinon.
 * - mono-tenant (`currentTenantId` null) → aucune vérification ;
 * - enregistrement non encore rattaché (`recordTenantId` null) → toléré
 *   (legacy avant backfill) ;
 * - sinon, exige l'égalité stricte.
 */
export function requireSameTenant(
  recordTenantId: string | null | undefined,
  currentTenantId: string | null,
): void {
  if (!currentTenantId) return;
  if (recordTenantId == null) return;
  if (recordTenantId !== currentTenantId) {
    throw new Error(
      `Accès refusé : ressource d'un autre tenant (${recordTenantId} ≠ ${currentTenantId}).`,
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────
   Garde-fous anti-fuite (Phase 3). Tous NEUTRES en mono-tenant (MULTI_TENANT
   off). À appeler aux points sensibles (lecture/écriture/suppression/relations)
   pour empêcher toute fuite cross-tenant. `currentTenantId` est le tenant résolu
   (getActiveTenantId / contexte ambiant).
   ──────────────────────────────────────────────────────────────────────── */

type WithTenant = { tenantId?: string | null } | null | undefined;

/** Un enregistrement appartient-il au tenant courant ? Lève sinon. */
export function assertRecordInTenant(record: WithTenant, currentTenantId: string | null): void {
  if (!isMultiTenantEnabled() || !currentTenantId) return;
  const rid = record?.tenantId ?? null;
  if (rid == null) return; // legacy non rattaché (avant attach-data) : toléré
  if (rid !== currentTenantId) {
    throw new Error(`Fuite tenant bloquée : enregistrement ${rid} ≠ tenant courant ${currentTenantId}.`);
  }
}

/** Deux extrémités d'une relation doivent être dans le tenant courant. Lève sinon. */
export function assertRelationSameTenant(left: WithTenant, right: WithTenant, currentTenantId: string | null): void {
  assertRecordInTenant(left, currentTenantId);
  assertRecordInTenant(right, currentTenantId);
}

/** Interdit une écriture « globale » (sans tenant) quand MULTI_TENANT est actif. */
export function forbidGlobalWriteInMultiTenant(currentTenantId: string | null): void {
  if (isMultiTenantEnabled() && !currentTenantId) {
    throw new Error("Écriture globale interdite en multi-tenant : tenant courant non résolu.");
  }
}

/** Interdit une suppression « globale » (sans tenant) quand MULTI_TENANT est actif. */
export function forbidGlobalDeleteInMultiTenant(currentTenantId: string | null): void {
  if (isMultiTenantEnabled() && !currentTenantId) {
    throw new Error("Suppression globale interdite en multi-tenant : tenant courant non résolu.");
  }
}

/** Exige que `data` porte un tenant_id quand MULTI_TENANT est actif. */
export function requireTenantIdWhenMultiTenant(data: WithTenant): void {
  if (isMultiTenantEnabled() && !data?.tenantId) {
    throw new Error("tenant_id requis en multi-tenant (donnée non rattachée).");
  }
}
