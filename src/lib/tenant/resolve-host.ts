import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   Résolution FUTURE du tenant par sous-domaine — PRÉPARÉE mais NON ACTIVE.
   Aujourd'hui le tenant est résolu par membership (cf. get-current-tenant.ts).
   Cette fonction n'est branchée nulle part : elle documente la stratégie cible.
   ──────────────────────────────────────────────────────────────────────── */

/** Domaines « portail » (login global) → aucun tenant déduit de l'hôte. */
const PORTAL_HOSTS = new Set(["app.gedify.fr", "staging.gedify.fr", "www.gedify.fr", "localhost", "127.0.0.1"]);

/** Sous-domaines réservés (jamais un slug de tenant). */
const RESERVED_SUBDOMAINS = new Set(["app", "staging", "www", "api", "admin"]);

/**
 * Déduit un slug de tenant depuis l'hôte (ex. `client.gedify.fr` → `client`),
 * ou `null` pour un domaine portail / non reconnu. À BRANCHER plus tard (Phase
 * sous-domaines) en complément de la résolution par membership.
 *
 *   client.gedify.fr   → "client"
 *   azserver.gedify.fr → "azserver"
 *   staging.gedify.fr  → null (portail)
 */
export function resolveTenantFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.split(":")[0].trim().toLowerCase();
  if (PORTAL_HOSTS.has(h)) return null;
  const m = h.match(/^([a-z0-9-]+)\.gedify\.fr$/);
  if (!m) return null;
  const slug = m[1];
  return RESERVED_SUBDOMAINS.has(slug) ? null : slug;
}
