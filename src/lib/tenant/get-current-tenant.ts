import "server-only";

import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { readSession } from "@/lib/auth/session";
import {
  DEFAULT_TENANT,
  DEFAULT_TENANT_ID,
  isMultiTenantEnabled,
  tenantRoleSatisfies,
} from "./tenant-config";
import { getTenantById, getTenantSettings, listMembershipsForUser } from "./tenant-store";
import type { TenantContext, TenantRole } from "./types";

/* ────────────────────────────────────────────────────────────────────────
   Résolution du tenant courant (Phase 1).

   • MULTI_TENANT désactivé (local / Synology / main / mono-tenant) : renvoie un
     contexte « tenant par défaut » SANS accès base → 100 % inerte.
   • MULTI_TENANT activé (SaaS) : résout l'utilisateur connecté puis son adhésion
     active (cookie `gedify-tenant` ou en-tête `x-tenant-id` si fourni, sinon la
     première). Lève une erreur claire si non connecté ou sans tenant.
   ──────────────────────────────────────────────────────────────────────── */

const TENANT_COOKIE = "gedify-tenant";
const TENANT_HEADER = "x-tenant-id";

export class TenantAccessError extends Error {
  constructor(
    message: string,
    readonly code: "not_authenticated" | "no_tenant" | "forbidden" = "no_tenant",
  ) {
    super(message);
    this.name = "TenantAccessError";
  }
}

async function readSelectedTenant(): Promise<string | null> {
  try {
    const h = await headers();
    const fromHeader = h.get(TENANT_HEADER);
    if (fromHeader) return fromHeader;
  } catch {
    /* hors contexte requête */
  }
  try {
    const c = await cookies();
    return c.get(TENANT_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Contexte tenant de la requête : { userId, tenantId, tenant, role }.
 * Lève TenantAccessError si non connecté ou sans tenant (mode multi-tenant).
 */
export async function getCurrentTenant(): Promise<TenantContext> {
  const user = await getCurrentUser();

  // ── Mode mono-tenant : tenant par défaut, accès « owner », sans base ───────
  if (!isMultiTenantEnabled()) {
    return {
      userId: user?.id ?? 0,
      username: user?.username ?? "local",
      email: user?.email ?? null,
      tenantId: DEFAULT_TENANT_ID,
      tenant: DEFAULT_TENANT,
      role: "owner",
      settings: null,
    };
  }

  // ── Mode multi-tenant (SaaS) ───────────────────────────────────────────────
  if (!user) {
    throw new TenantAccessError("Non authentifié : aucune session utilisateur.", "not_authenticated");
  }

  const memberships = await listMembershipsForUser(user.id);
  if (memberships.length === 0) {
    throw new TenantAccessError("Aucun tenant associé à cet utilisateur.", "no_tenant");
  }

  const selected = await readSelectedTenant();
  const membership =
    (selected && memberships.find((m) => m.tenantId === selected)) || memberships[0];

  const tenant = await getTenantById(membership.tenantId);
  if (!tenant) {
    throw new TenantAccessError(`Tenant introuvable : ${membership.tenantId}.`, "no_tenant");
  }

  const settings = await getTenantSettings(tenant.id).catch(() => null);

  return {
    userId: user.id,
    username: user.username,
    email: user.email ?? null,
    tenantId: tenant.id,
    tenant,
    role: membership.role,
    settings,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   Diagnostic SÛR (jamais de secret : pas de password_hash, pas de token).
   Sert au débogage de la résolution de tenant sur /admin/saas/tenant.
   ──────────────────────────────────────────────────────────────────────── */
export type TenantDebug = {
  multiTenant: boolean;
  sessionDetected: boolean;
  sessionIdentifier: string | null;
  userId: number | null;
  username: string | null;
  email: string | null;
  membershipFound: boolean;
  tenantFound: boolean;
  settingsFound: boolean;
  role: string | null;
};

export async function getTenantDebug(): Promise<TenantDebug> {
  const multiTenant = isMultiTenantEnabled();
  const session = await readSession();
  const user = await getCurrentUser();

  const debug: TenantDebug = {
    multiTenant,
    sessionDetected: Boolean(session?.username),
    sessionIdentifier: session?.username ?? null,
    userId: user?.id ?? null,
    username: user?.username ?? null,
    email: user?.email ?? null,
    membershipFound: false,
    tenantFound: false,
    settingsFound: false,
    role: null,
  };

  if (!multiTenant) {
    debug.membershipFound = true;
    debug.tenantFound = true;
    debug.role = "owner";
    return debug;
  }
  if (!user) return debug;

  try {
    const memberships = await listMembershipsForUser(user.id);
    if (memberships.length === 0) return debug;
    const selected = await readSelectedTenant();
    const membership =
      (selected && memberships.find((m) => m.tenantId === selected)) || memberships[0];
    debug.membershipFound = true;
    debug.role = membership.role;
    const tenant = await getTenantById(membership.tenantId);
    debug.tenantFound = Boolean(tenant);
    if (tenant) {
      const s = await getTenantSettings(tenant.id).catch(() => null);
      debug.settingsFound = Boolean(s);
    }
  } catch {
    /* laissé en l'état — le diagnostic reste partiel mais sans erreur */
  }
  return debug;
}

/**
 * Identifiant du tenant actif (léger, sans charger tenant/settings), ou `null`
 * si non résolvable (mono-tenant, hors requête, non authentifié, sans
 * membership). Ne lève jamais. Utilisé par la couche de stockage pour le
 * filtrage/confinement (cf. tenant-scope.ts).
 */
export async function getActiveTenantId(): Promise<string | null> {
  if (!isMultiTenantEnabled()) return null;
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const memberships = await listMembershipsForUser(user.id);
    if (memberships.length === 0) return null;
    const selected = await readSelectedTenant();
    const membership =
      (selected && memberships.find((m) => m.tenantId === selected)) || memberships[0];
    return membership.tenantId;
  } catch {
    return null;
  }
}

/** Alias explicite pour les routes/actions : renvoie le contexte ou lève. */
export async function requireTenant(): Promise<TenantContext> {
  return getCurrentTenant();
}

/** Exige que le rôle tenant courant soit dans `allowed`, sinon lève. */
export async function requireTenantRole(allowed: TenantRole[]): Promise<TenantContext> {
  const ctx = await getCurrentTenant();
  if (!tenantRoleSatisfies(ctx.role, allowed)) {
    throw new TenantAccessError(
      `Rôle insuffisant (${ctx.role}). Requis : ${allowed.join(", ")}.`,
      "forbidden",
    );
  }
  return ctx;
}

/** L'utilisateur courant est-il owner du tenant courant ? (jamais d'exception) */
export async function isTenantOwner(): Promise<boolean> {
  try {
    const ctx = await getCurrentTenant();
    return ctx.role === "owner";
  } catch {
    return false;
  }
}

/**
 * Vérifie que l'utilisateur courant a bien accès au tenant `tenantId` (= son
 * tenant courant). Lève TenantAccessError sinon. Utile pour confiner une
 * ressource à son tenant lors des futures étapes (filtrage tenant_id).
 */
export async function assertTenantAccess(tenantId: string): Promise<TenantContext> {
  const ctx = await getCurrentTenant();
  if (ctx.tenantId !== tenantId) {
    throw new TenantAccessError(
      `Accès refusé : ressource du tenant ${tenantId}, contexte ${ctx.tenantId}.`,
      "forbidden",
    );
  }
  return ctx;
}
