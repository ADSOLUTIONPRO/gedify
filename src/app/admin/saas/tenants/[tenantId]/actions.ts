"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { updateTenant, updateTenantSettings, setTenantStatus, applyPlanToSettings, type TenantStatusValue } from "@/lib/tenant/tenant-admin";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = str(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
function bool(v: FormDataEntryValue | null): boolean {
  return str(v) === "on" || str(v) === "true";
}

async function requireSuperuser(): Promise<void> {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
}

function back(tenantId: string, err?: string): never {
  const q = err ? `?error=${encodeURIComponent(err)}` : "?updated=1";
  redirect(`/admin/saas/tenants/${encodeURIComponent(tenantId)}${q}`);
}

/** Met à jour plan/statut. SUPERUSER uniquement. */
export async function updateTenantFormAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const tenantId = str(formData.get("tenantId"));
  try {
    await updateTenant(tenantId, { plan: str(formData.get("plan")), status: str(formData.get("status")) });
  } catch (e) {
    back(tenantId, e instanceof Error ? e.message : "Erreur.");
  }
  back(tenantId);
}

/** Met à jour les limites/fonctionnalités. SUPERUSER uniquement. */
export async function updateSettingsFormAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const tenantId = str(formData.get("tenantId"));
  try {
    await updateTenantSettings(tenantId, {
      maxUsers: intOrNull(formData.get("maxUsers")),
      maxDocuments: intOrNull(formData.get("maxDocuments")),
      maxStorageMb: intOrNull(formData.get("maxStorageMb")),
      aiEnabled: bool(formData.get("aiEnabled")),
      ocrEnabled: bool(formData.get("ocrEnabled")),
      emailImportEnabled: bool(formData.get("emailImportEnabled")),
      onlyofficeEnabled: bool(formData.get("onlyofficeEnabled")),
    });
  } catch (e) {
    back(tenantId, e instanceof Error ? e.message : "Erreur.");
  }
  back(tenantId);
}

/** Applique les limites du plan courant. SUPERUSER uniquement. */
export async function applyPlanFormAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const tenantId = str(formData.get("tenantId"));
  try {
    await applyPlanToSettings(tenantId);
  } catch (e) {
    back(tenantId, e instanceof Error ? e.message : "Erreur.");
  }
  back(tenantId);
}

/** Suspend ou réactive le tenant. SUPERUSER uniquement. */
export async function setStatusFormAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const tenantId = str(formData.get("tenantId"));
  const status = str(formData.get("status")) as TenantStatusValue;
  try {
    await setTenantStatus(tenantId, status);
  } catch (e) {
    back(tenantId, e instanceof Error ? e.message : "Erreur.");
  }
  back(tenantId);
}
