"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit/audit-store";
import { updateSaasSettings, type SettingsSection } from "@/lib/saas/settings";

type FieldType = "bool" | "int" | "float" | "string";

async function requireSuperuser(): Promise<string> {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
  return me.username;
}
function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }

function buildPatch(formData: FormData, spec: Record<string, FieldType>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, type] of Object.entries(spec)) {
    const raw = s(formData.get(key));
    if (type === "bool") patch[key] = raw === "1" || raw === "on" || raw === "true";
    else if (type === "int") patch[key] = Math.max(0, Math.round(Number(raw) || 0));
    else if (type === "float") patch[key] = Number(raw.replace(",", ".")) || 0;
    else patch[key] = raw;
  }
  return patch;
}

async function save(section: SettingsSection, spec: Record<string, FieldType>, formData: FormData, auditAction: string): Promise<void> {
  const actor = await requireSuperuser();
  const patch = buildPatch(formData, spec);
  await updateSaasSettings(section, patch, actor);
  if (auditAction !== "saas_settings_updated") await recordAudit({ action: auditAction, target: section, user: actor });
  revalidatePath("/admin/saas/settings");
  redirect(`/admin/saas/settings?saved=${section}`);
}

export async function saveSignupAction(formData: FormData): Promise<void> {
  await save("signup", { publicSignupEnabled: "bool", inviteOnly: "bool", requireEmailVerification: "bool", requireAdminApproval: "bool", autoCreateTenant: "bool", defaultPlan: "string", demoTenantAllowed: "bool" }, formData, "signup_policy_updated");
}
export async function saveUrlsAction(formData: FormData): Promise<void> {
  await save("urls", { supportUrl: "string", termsUrl: "string", privacyUrl: "string", primaryDomain: "string", subdomainsEnabled: "bool", customDomainsEnabled: "bool" }, formData, "saas_settings_updated");
}
export async function saveEmailsAction(formData: FormData): Promise<void> {
  await save("emails", { fromName: "string", supportEmail: "string", billingEmail: "string", noreplyEmail: "string", contactEmail: "string" }, formData, "saas_settings_updated");
}
export async function saveLimitsAction(formData: FormData): Promise<void> {
  await save("limits", { maxUsers: "int", maxDocuments: "int", maxStorageMb: "int", maxUploadMb: "int", maxTestTenants: "int", maxPendingInvitations: "int", trialDays: "int" }, formData, "saas_settings_updated");
}
export async function savePaymentAction(formData: FormData): Promise<void> {
  await save("payment", { graceDays: "int", premiumRestrictDays: "int", uploadBlockDays: "int", suspendDays: "int", autoRemindersEnabled: "bool", maxReminders: "int" }, formData, "payment_policy_updated");
}
export async function saveSecurityAction(formData: FormData): Promise<void> {
  // Garde-fou : activer le mode maintenance exige une confirmation explicite.
  const actor = await requireSuperuser();
  const maintenance = s(formData.get("maintenanceMode")) === "1";
  if (maintenance && s(formData.get("confirm")) !== "1") {
    redirect("/admin/saas/settings?error=" + encodeURIComponent("Activer le mode maintenance exige la case de confirmation."));
  }
  const patch = buildPatch(formData, { require2fa: "bool", sessionDurationHours: "int", bruteForceProtection: "bool", auditLogsEnabled: "bool", maintenanceMode: "bool" });
  await updateSaasSettings("security", patch, actor);
  if (maintenance) await recordAudit({ action: "maintenance_mode_changed", target: "security", details: "enabled", user: actor });
  revalidatePath("/admin/saas/settings");
  redirect("/admin/saas/settings?saved=security");
}
export async function saveSupportAction(formData: FormData): Promise<void> {
  await save("support", { humanSupportEnabled: "bool", chatEnabled: "bool", ticketsEnabled: "bool", attachmentsEnabled: "bool", maxAttachmentMb: "int", hours: "string", welcomeMessage: "string" }, formData, "support_policy_updated");
}
export async function saveBillingDefaultsAction(formData: FormData): Promise<void> {
  await save("billing", { invoicePrefix: "string", creditNotePrefix: "string", paymentTermsDays: "int", defaultVatRate: "float", currency: "string" }, formData, "saas_settings_updated");
}
export async function saveTrialsAction(formData: FormData): Promise<void> {
  await save("trials", { defaultPlan: "string", fallbackPlan: "string", reminder7d: "bool", reminder3d: "bool", reminder1d: "bool", expiredEmail: "bool", restrictPremiumAfter: "bool", suspendAfterDays: "int", allowManualExtension: "bool" }, formData, "saas_settings_updated");
}
export async function saveFeaturesAction(formData: FormData): Promise<void> {
  const actor = await requireSuperuser();
  const patch = buildPatch(formData, { ai: "bool", ocr: "bool", emailImport: "bool", onlyoffice: "bool", mailing: "bool", support: "bool", marketingCampaigns: "bool", publicSignup: "bool" });
  await updateSaasSettings("features", patch, actor);
  await recordAudit({ action: "global_feature_toggled", target: "features", details: Object.entries(patch).filter(([, v]) => v === false).map(([k]) => k).join(",") || "all-on", user: actor });
  revalidatePath("/admin/saas/settings");
  redirect("/admin/saas/settings?saved=features");
}
