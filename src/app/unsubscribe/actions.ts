"use server";

import { redirect } from "next/navigation";
import { applyUnsubByToken } from "@/lib/saas/mailing/preferences";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }

/** Action publique : applique le choix de désinscription via token opaque. */
export async function unsubscribeAction(formData: FormData): Promise<void> {
  const token = s(formData.get("token"));
  if (!token) redirect("/unsubscribe?status=error");
  const scope = s(formData.get("scope")); // "all" | "marketing"
  const ok = await applyUnsubByToken(token, {
    unsubAll: scope === "all" ? true : undefined,
    unsubMarketing: scope === "marketing" || scope === "all" ? true : undefined,
  });
  redirect(`/unsubscribe?token=${encodeURIComponent(token)}&status=${ok ? "done" : "error"}`);
}
