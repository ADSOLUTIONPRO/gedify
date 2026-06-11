import { MessageSquarePlus, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { isFeatureEnabled } from "@/lib/saas/entitlements";
import { createSupportConversationAction } from "../actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/support", label: "Aide & support" },
  { label: "Nouvelle demande" },
];
const cls = "h-9 w-full rounded-lg border px-2 text-[13px]";

export default async function NewSupportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) redirect("/support");
  const humanSupport = await isFeatureEnabled(ctx.tenantId, "human_support_enabled");
  if (!humanSupport) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Nouvelle demande" />
        <SectionCard icon={ShieldAlert} title="Non inclus dans votre offre"><p className="text-sm text-slate-600">Le support humain n&apos;est pas disponible sur votre offre actuelle.</p></SectionCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Nouvelle demande" description="Décrivez votre besoin, un conseiller vous répondra." />
      {error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{error}</div> : null}

      <SectionCard icon={MessageSquarePlus} title="Votre demande">
        <form action={createSupportConversationAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-[12px]"><span className="font-semibold">Sujet</span><input name="subject" required className={cls} style={{ borderColor: "var(--border)" }} /></label>
            <label className="space-y-1 text-[12px]">
              <span className="font-semibold">Priorité</span>
              <select name="priority" className={cls} style={{ borderColor: "var(--border)" }} defaultValue="normal">
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-[12px]"><span className="font-semibold">Message</span><textarea name="body" required rows={6} className="w-full rounded-lg border p-2 text-[13px]" style={{ borderColor: "var(--border)" }} /></label>
          <button className="h-10 rounded-xl px-5 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Envoyer la demande</button>
        </form>
      </SectionCard>
    </PageShell>
  );
}
