import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { isTenantAdmin } from "@/lib/tenant/permissions";
import type { EngineUser } from "@/lib/engine/stores";
import type { TenantContext } from "@/lib/tenant/types";

/* Garde-fous serveur réutilisables. Les pages /admin/saas/* sont déjà protégées
   par leur layout (403 superuser) ; ces helpers offrent une vérification
   explicite et le routage client → /settings. */

/** Superuser plateforme requis. Sinon : login (anon) ou /settings (client). */
export async function requireSuperuser(): Promise<EngineUser> {
  const me = await getCurrentUser();
  if (!me) redirect("/login?reason=auth_required");
  if (!me.is_superuser) {
    try {
      const { logSecurityEvent } = await import("@/lib/saas/security/security-events");
      await logSecurityEvent({ eventType: "unauthorized_admin_access", category: "access", severity: "warning", actorUserId: me.id, message: "Tentative d'accès à l'administration plateforme par un non-superuser" });
    } catch { /* best-effort */ }
    redirect("/settings");
  }
  return me;
}

/** Tenant courant requis (membre d'un espace). */
export async function requireTenantMember(): Promise<TenantContext> {
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) redirect("/dashboard");
  return ctx;
}

/** Owner ou admin du tenant courant requis. */
export async function requireTenantOwnerOrAdmin(): Promise<TenantContext> {
  const ctx = await requireTenantMember();
  if (!isTenantAdmin(ctx.role)) redirect("/settings");
  return ctx;
}

/** True si l'utilisateur courant est un client (multi-tenant, non superuser). */
export async function isTenantClient(): Promise<boolean> {
  const { isMultiTenantEnabled } = await import("@/lib/tenant/tenant-config");
  if (!isMultiTenantEnabled()) return false;
  const me = await getCurrentUser().catch(() => null);
  return Boolean(me) && !me?.is_superuser;
}
