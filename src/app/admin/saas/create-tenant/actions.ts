"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createTenantWithOwner } from "@/lib/tenant/tenant-admin";

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

/** Création d'un tenant via le formulaire admin. SUPERUSER uniquement. */
export async function createTenantFormAction(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");

  let tenantId: string;
  try {
    const res = await createTenantWithOwner({
      name: str(formData.get("name")),
      slug: str(formData.get("slug")),
      ownerEmail: str(formData.get("ownerEmail")),
      ownerUsername: str(formData.get("ownerUsername")),
      ownerPassword: str(formData.get("ownerPassword")),
      plan: str(formData.get("plan")) || "free",
      status: str(formData.get("status")) || "trial",
      maxUsers: intOrNull(formData.get("maxUsers")),
      maxDocuments: intOrNull(formData.get("maxDocuments")),
      maxStorageMb: intOrNull(formData.get("maxStorageMb")),
      aiEnabled: bool(formData.get("aiEnabled")),
      ocrEnabled: bool(formData.get("ocrEnabled")),
      emailImportEnabled: bool(formData.get("emailImportEnabled")),
      onlyofficeEnabled: bool(formData.get("onlyofficeEnabled")),
    });
    tenantId = res.tenantId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur lors de la création.";
    redirect(`/admin/saas/create-tenant?error=${encodeURIComponent(msg)}`);
  }
  // Hors du try : la redirection de succès ne doit pas être interceptée.
  redirect(`/admin/saas/tenants/${encodeURIComponent(tenantId)}?created=1`);
}
