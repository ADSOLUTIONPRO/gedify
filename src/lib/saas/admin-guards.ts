import "server-only";

import { NextResponse } from "next/server";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";

/* Garde-fous d'administration GLOBALE en mode multi-tenant SaaS.
   En mono-tenant (local/Synology), comportement historique inchangé (null). */

/** True si l'utilisateur courant est superuser plateforme. */
export async function isPlatformSuperuser(): Promise<boolean> {
  const me = await getCurrentUser().catch(() => null);
  return Boolean(me?.is_superuser);
}

/** Doit-on restreindre les actions admin globales (multi-tenant + non-superuser) ? */
export async function shouldRestrictGlobalAdmin(): Promise<boolean> {
  if (!isMultiTenantEnabled()) return false;
  return !(await isPlatformSuperuser());
}

/**
 * À appeler en tête d'une route admin GLOBALE (sauvegarde, reset, maintenance,
 * export, import, sync, nettoyage…). Renvoie une 403 à retourner si l'appelant
 * n'est pas superuser plateforme en mode multi-tenant ; sinon null.
 * Journalise une tentative d'accès non autorisé (best-effort).
 */
export async function denyGlobalAdminForTenant(action = "global_admin"): Promise<NextResponse | null> {
  if (!isMultiTenantEnabled()) return null;
  const me = await getCurrentUser().catch(() => null);
  if (me?.is_superuser) return null;
  try {
    const { logSecurityEvent } = await import("@/lib/saas/security/security-events");
    await logSecurityEvent({
      eventType: "unauthorized_access", category: "access", severity: "warning",
      actorUserId: me?.id ?? null, targetType: "admin_action", targetId: action,
      message: `Action d'administration globale refusée à un non-superuser : ${action}`,
    });
  } catch { /* best-effort */ }
  return NextResponse.json(
    { error: "Action réservée à l'administrateur de la plateforme (superuser).", errorType: "ged_global_admin" },
    { status: 403 },
  );
}
