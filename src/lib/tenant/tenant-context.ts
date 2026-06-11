import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/* ────────────────────────────────────────────────────────────────────────
   Contexte tenant AMBIANT (AsyncLocalStorage).

   Sert aux exécutions HORS contexte requête (jobs de fond, tâches planifiées) :
   on enveloppe le traitement d'une ressource dans `runWithTenant(tenantId, fn)`,
   et la couche de stockage (via getActiveTenantId → activeTenantIdFor) résout
   alors ce tenant → lectures filtrées + écritures confinées, exactement comme
   dans une requête authentifiée.

   En contexte requête web, l'ALS n'est pas posé : la résolution retombe sur la
   session/membership. En mono-tenant (MULTI_TENANT off), tout est neutre.
   ──────────────────────────────────────────────────────────────────────── */

type TenantStore = { tenantId: string };

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * Exécute `fn` avec un tenant ambiant. Si `tenantId` est null/vide, exécute
 * `fn` SANS contexte (comportement historique) — utile pour les données legacy
 * non rattachées ou le mode mono-tenant.
 */
export function runWithTenant<T>(tenantId: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  if (!tenantId) return fn();
  return storage.run({ tenantId }, fn);
}

/** Tenant ambiant courant (posé par runWithTenant), ou null. */
export function getAmbientTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}
