"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMultiTenantEnabled, TENANT_COOKIE_NAME } from "@/lib/tenant/tenant-config";
import { listMembershipsForUser } from "@/lib/tenant/tenant-store";

/** Secure cookie ? (même logique que la session — cf. lib/auth/session.ts). */
function cookieSecure(): boolean {
  const v = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Sélectionne le tenant ACTIF. Sécurité : on VÉRIFIE côté serveur que
 * l'utilisateur possède un membership sur ce tenant — un non-membre ne peut
 * jamais l'activer. Le tenant est stocké dans un cookie httpOnly (illisible/
 * non modifiable par le JS client) ; il reste de toute façon revalidé à chaque
 * résolution (getCurrentTenant).
 */
export async function selectTenantAction(tenantId: string): Promise<void> {
  if (!isMultiTenantEnabled()) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/select-tenant");

  const memberships = await listMembershipsForUser(user.id);
  if (!memberships.some((m) => m.tenantId === tenantId)) {
    // Non-membre : refus strict (pas de fuite cross-tenant).
    throw new Error("Accès refusé : vous n'êtes pas membre de cet espace.");
  }

  const store = await cookies();
  store.set({
    name: TENANT_COOKIE_NAME,
    value: tenantId,
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });

  redirect("/");
}
