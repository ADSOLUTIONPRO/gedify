import "server-only";

import { isMultiTenantEnabled } from "./tenant-config";

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
