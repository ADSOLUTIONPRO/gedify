"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSaasSettings } from "@/lib/saas/settings";
import {
  createDomain, getDomain, setPrimary, setDomainStatus, deleteDomain, updateDomainChecks,
} from "@/lib/saas/domains/domain-store";
import { checkDomainDns, validateDomainOwnership } from "@/lib/saas/domains/dns-check";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
async function su() { const me = await getCurrentUser(); if (!me?.is_superuser) redirect("/admin/saas/tenants"); }

export async function createDomainAction(formData: FormData): Promise<void> {
  await su();
  const tenantId = s(formData.get("tenantId"));
  const type = (s(formData.get("type")) || "subdomain") as "subdomain" | "custom_domain";
  const settings = await getSaasSettings();
  let domain: string;
  if (type === "subdomain") {
    const label = s(formData.get("label")).toLowerCase();
    domain = `${label}.${settings.urls.primaryDomain}`;
  } else {
    domain = s(formData.get("domain"));
  }
  if (!tenantId || !domain) redirect("/admin/saas/domains?error=" + encodeURIComponent("Client et domaine requis."));
  try {
    const id = await createDomain({ tenantId, domain, type, primaryDomain: settings.urls.primaryDomain });
    revalidatePath("/admin/saas/domains");
    redirect(`/admin/saas/domains/${id}?created=1`);
  } catch (e) {
    redirect("/admin/saas/domains?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur"));
  }
}

export async function verifyDnsAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  const dom = await getDomain(id);
  if (!dom) redirect("/admin/saas/domains");
  const settings = await getSaasSettings();
  const expected = `app.${settings.urls.primaryDomain}`;
  const res = await checkDomainDns(dom.domain, expected);
  await updateDomainChecks(id, { dnsStatus: res.ok ? "valid" : "invalid" });
  redirect(`/admin/saas/domains/${id}?dns=${res.ok ? "ok" : "fail"}`);
}

export async function verifyOwnershipAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  const dom = await getDomain(id);
  if (!dom) redirect("/admin/saas/domains");
  if (!dom.verificationToken) { await updateDomainChecks(id, { verificationStatus: "verified" }); redirect(`/admin/saas/domains/${id}?verif=ok`); }
  const res = await validateDomainOwnership(dom.domain, dom.verificationToken);
  await updateDomainChecks(id, { verificationStatus: res.ok ? "verified" : "failed" });
  redirect(`/admin/saas/domains/${id}?verif=${res.ok ? "ok" : "fail"}`);
}

export async function setPrimaryAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  if (id) await setPrimary(id);
  revalidatePath("/admin/saas/domains");
  redirect(`/admin/saas/domains/${id}?updated=1`);
}

export async function toggleDomainAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  const enable = s(formData.get("enable")) === "1";
  const dom = await getDomain(id);
  if (enable && dom && dom.type === "custom_domain" && dom.verificationStatus !== "verified") {
    redirect(`/admin/saas/domains/${id}?error=` + encodeURIComponent("Vérifiez la propriété du domaine avant activation."));
  }
  if (id) await setDomainStatus(id, enable ? "active" : "disabled");
  revalidatePath("/admin/saas/domains");
  redirect(`/admin/saas/domains/${id}?updated=1`);
}

export async function deleteDomainAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  if (id) await deleteDomain(id);
  revalidatePath("/admin/saas/domains");
  redirect("/admin/saas/domains?deleted=1");
}
