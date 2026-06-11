/* Types du socle multi-tenant SaaS (Phase 1 — fondations). */

export type TenantRole = "owner" | "admin" | "member" | "viewer";

export type TenantStatus = "active" | "suspended" | "archived";

export type Tenant = {
  id: string;
  name: string | null;
  slug: string;
  plan: string | null;
  status: TenantStatus | string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Membership = {
  id: string;
  userId: number;
  tenantId: string;
  role: TenantRole;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TenantSettings = {
  id: string;
  tenantId: string;
  maxUsers: number | null;
  maxDocuments: number | null;
  maxStorageMb: number | null;
  aiEnabled: boolean;
  ocrEnabled: boolean;
  emailImportEnabled: boolean;
  onlyofficeEnabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Contexte tenant résolu pour la requête courante. */
export type TenantContext = {
  userId: number;
  tenantId: string;
  tenant: Tenant;
  role: TenantRole;
};
