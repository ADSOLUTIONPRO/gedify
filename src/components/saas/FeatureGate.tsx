import type { ReactNode } from "react";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getActiveTenantId } from "@/lib/tenant/get-current-tenant";
import { isFeatureEnabled } from "@/lib/saas/entitlements";

/**
 * Affiche `children` UNIQUEMENT si la fonctionnalité est incluse dans l'offre
 * effective du tenant courant. Sinon `fallback` (ou rien). Composant SERVEUR.
 *
 * ⚠️ Garde d'INTERFACE seulement : le serveur doit AUSSI bloquer la route/action
 * correspondante via assertFeatureEnabled (cf. entitlements.ts).
 *
 *   <FeatureGate feature="ai_document_analysis_enabled"> … </FeatureGate>
 */
export async function FeatureGate({
  feature,
  children,
  fallback = null,
}: {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  // Hors SaaS (mono-tenant/local/Synology) ou hors contexte tenant : tout est visible.
  if (!isMultiTenantEnabled()) return <>{children}</>;
  const tenantId = await getActiveTenantId().catch(() => null);
  if (!tenantId) return <>{children}</>;
  const ok = await isFeatureEnabled(tenantId, feature).catch(() => true);
  return ok ? <>{children}</> : <>{fallback}</>;
}
