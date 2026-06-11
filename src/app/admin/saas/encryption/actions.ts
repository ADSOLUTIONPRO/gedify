"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isEncryptionConfigured } from "@/lib/saas/encryption/master-key";
import { ensureTenantKey } from "@/lib/saas/encryption/tenant-keys";
import { listTenants } from "@/lib/tenant/tenant-store";

async function requireSuperuser() {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
}

/** Génère les clés manquantes pour tous les tenants (idempotent). */
export async function ensureAllKeysAction(): Promise<void> {
  await requireSuperuser();
  if (!isEncryptionConfigured()) {
    redirect("/admin/saas/encryption?error=" + encodeURIComponent("ENCRYPTION_MASTER_KEY non configurée."));
  }
  const tenants = await listTenants().catch(() => []);
  let created = 0;
  for (const t of tenants) {
    try { if (await ensureTenantKey(t.id)) created++; } catch { /* ignore */ }
  }
  revalidatePath("/admin/saas/encryption");
  redirect(`/admin/saas/encryption?created=${created}`);
}
