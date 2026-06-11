"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createManualSubscription,
  updateSubscriptionStatus,
  cancelSubscription,
  resumeSubscription,
} from "@/lib/saas/subscriptions";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}
async function requireSuperuser(): Promise<void> {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
}
function back(to: string, err?: string): never {
  redirect(`${to}${err ? `?error=${encodeURIComponent(err)}` : "?updated=1"}`);
}

/** `redirectTo` permet de revenir sur la liste OU la fiche tenant. */
export async function createManualSubscriptionAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const tenantId = str(formData.get("tenantId"));
  const to = str(formData.get("redirectTo")) || "/admin/saas/subscriptions";
  try {
    await createManualSubscription(tenantId, str(formData.get("plan")) || "free", str(formData.get("status")) || "active");
  } catch (e) {
    back(to, e instanceof Error ? e.message : "Erreur.");
  }
  back(to);
}

export async function setSubscriptionStatusAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const tenantId = str(formData.get("tenantId"));
  const to = str(formData.get("redirectTo")) || "/admin/saas/subscriptions";
  const status = str(formData.get("status"));
  try {
    if (status === "canceled") await cancelSubscription(tenantId);
    else if (status === "__resume__") await resumeSubscription(tenantId);
    else await updateSubscriptionStatus(tenantId, status);
  } catch (e) {
    back(to, e instanceof Error ? e.message : "Erreur.");
  }
  back(to);
}
