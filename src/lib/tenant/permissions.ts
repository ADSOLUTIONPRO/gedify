import "server-only";

import type { TenantRole } from "./types";

/* Permissions tenant (séparées du superuser plateforme). Hiérarchie :
   owner > admin > member > viewer. Le superuser plateforme contourne tout. */

const RANK: Record<TenantRole, number> = { owner: 3, admin: 2, member: 1, viewer: 0 };

export function isTenantOwner(role: TenantRole | string | null | undefined): boolean {
  return role === "owner";
}
export function isTenantAdmin(role: TenantRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
export function roleAtLeast(role: TenantRole | string | null | undefined, min: TenantRole): boolean {
  const r = (role && role in RANK ? role : "viewer") as TenantRole;
  return RANK[r] >= RANK[min];
}

/** Peut gérer les membres (inviter, changer rôle, retirer) ? owner/admin. */
export function canManageTenantMembers(role: TenantRole | string | null | undefined): boolean {
  return isTenantAdmin(role);
}
export function canInviteTenantMember(role: TenantRole | string | null | undefined): boolean {
  return isTenantAdmin(role);
}
export function canChangeTenantRole(actorRole: TenantRole | string | null | undefined, targetRole: TenantRole, newRole: TenantRole): boolean {
  if (isTenantOwner(actorRole)) return true; // owner : tout
  if (!isTenantAdmin(actorRole)) return false;
  // admin : ne peut pas créer/modifier un owner
  return targetRole !== "owner" && newRole !== "owner";
}
export function canRemoveTenantMember(actorRole: TenantRole | string | null | undefined, targetRole: TenantRole): boolean {
  if (isTenantOwner(actorRole)) return true;
  if (!isTenantAdmin(actorRole)) return false;
  return targetRole !== "owner";
}

/** Rôles qu'un acteur a le droit d'attribuer en invitant. */
export function assignableRoles(actorRole: TenantRole | string | null | undefined, isSuperuser = false): TenantRole[] {
  if (isSuperuser || isTenantOwner(actorRole)) return ["owner", "admin", "member", "viewer"];
  if (isTenantAdmin(actorRole)) return ["member", "viewer"];
  return [];
}

/** Empêche de retirer/rétrograder le DERNIER owner d'un tenant. */
export function assertNotLastOwner(members: { role: string }[], targetRole: string): void {
  if (targetRole !== "owner") return;
  const owners = members.filter((m) => m.role === "owner").length;
  if (owners <= 1) throw new Error("Impossible : c'est le dernier propriétaire (owner) de l'espace.");
}
