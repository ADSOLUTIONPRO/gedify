import "server-only";

import type { Tenant, TenantRole } from "./types";

/* ────────────────────────────────────────────────────────────────────────
   Configuration du socle multi-tenant. TOUT est conditionné par l'env
   `MULTI_TENANT` : désactivé par défaut → aucun impact sur main / Synology /
   local / gedify.azserver.fr. Activé uniquement sur les environnements SaaS.
   ──────────────────────────────────────────────────────────────────────── */

/** Le mode multi-tenant est-il activé ? (env MULTI_TENANT=true|1|yes). */
export function isMultiTenantEnabled(): boolean {
  const v = process.env.MULTI_TENANT?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/** Identifiant/slug du tenant par défaut en mode mono-tenant (SaaS désactivé). */
export const DEFAULT_TENANT_ID = "default";

/**
 * Tenant synthétique renvoyé en mode mono-tenant (SaaS désactivé) : permet à
 * getCurrentTenant() de répondre SANS accès base, donc 100 % inerte pour les
 * déploiements local/Synology/main.
 */
export const DEFAULT_TENANT: Tenant = {
  id: DEFAULT_TENANT_ID,
  name: "Gedify",
  slug: DEFAULT_TENANT_ID,
  plan: "local",
  status: "active",
  createdAt: null,
  updatedAt: null,
};

/** Hiérarchie des rôles tenant (du plus puissant au moins puissant). */
export const TENANT_ROLE_ORDER: TenantRole[] = ["owner", "admin", "member", "viewer"];

/** Le rôle `role` satisfait-il l'un des rôles requis `allowed` ? */
export function tenantRoleSatisfies(role: TenantRole, allowed: TenantRole[]): boolean {
  return allowed.includes(role);
}
