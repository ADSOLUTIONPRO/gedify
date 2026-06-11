import Link from "next/link";
import { Globe, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDomain } from "@/lib/saas/domains/domain-store";
import { getSaasSettings } from "@/lib/saas/settings";
import { verifyDnsAction, verifyOwnershipAction, setPrimaryAction, toggleDomainAction, deleteDomainAction } from "../actions";

export const dynamic = "force-dynamic";

function when(v: unknown): string { return v ? new Date(String(v)).toLocaleString("fr-FR") : "—"; }

export default async function DomainDetailPage({ params, searchParams }: { params: Promise<{ domainId: string }>; searchParams: Promise<Record<string, string>> }) {
  const { domainId } = await params;
  const sp = await searchParams;
  const breadcrumb = [
    { href: "/dashboard", label: "Accueil" },
    { href: "/admin/saas/domains", label: "Domaines" },
    { label: domainId.slice(0, 8) },
  ];
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Domaine" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const dom = await getDomain(domainId);
  if (!dom) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Introuvable" /><SectionCard icon={Globe} title="Introuvable"><p className="text-sm text-slate-600">Ce domaine n&apos;existe pas.</p></SectionCard></PageShell>;
  }
  const settings = await getSaasSettings();
  const cnameTarget = `app.${settings.urls.primaryDomain}`;
  const isCustom = dom.type === "custom_domain";

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title={dom.domain} description={`Tenant ${dom.tenantId} · ${dom.type === "subdomain" ? "sous-domaine" : "domaine personnalisé"}`} />
      {sp.created ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Domaine créé.</div> : null}
      {sp.dns === "ok" ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">DNS valide.</div> : null}
      {sp.dns === "fail" ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">DNS non résolu / incorrect.</div> : null}
      {sp.verif === "ok" ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Propriété vérifiée.</div> : null}
      {sp.verif === "fail" ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">TXT de vérification introuvable.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      <SectionCard icon={Globe} title="État">
        <MetadataGrid columns={3} items={[
          { label: "Statut", value: dom.status },
          { label: "DNS", value: dom.dnsStatus },
          { label: "SSL", value: dom.sslStatus },
          { label: "Vérification", value: dom.verificationStatus },
          { label: "Principal", value: dom.isPrimary ? "Oui" : "Non" },
          { label: "Dernier contrôle", value: when(dom.lastCheckedAt) },
        ]} />
      </SectionCard>

      <SectionCard icon={Globe} title="Instructions DNS">
        {dom.type === "subdomain" ? (
          <div className="space-y-2 text-[13px]">
            <p className="text-slate-600">Sous-domaine géré par la plateforme. Assurez-vous que le wildcard <code className="font-mono">*.{settings.urls.primaryDomain}</code> pointe vers l&apos;application (configuration DNS plateforme).</p>
            <table className="text-[12.5px]"><tbody>
              <tr><td className="pr-4 font-semibold">Type</td><td>CNAME (ou A)</td></tr>
              <tr><td className="pr-4 font-semibold">Nom</td><td><code className="font-mono">{dom.domain}</code></td></tr>
              <tr><td className="pr-4 font-semibold">Valeur</td><td><code className="font-mono">{cnameTarget}</code></td></tr>
            </tbody></table>
          </div>
        ) : (
          <div className="space-y-3 text-[13px]">
            <p className="text-slate-600">Le client doit créer ces enregistrements DNS :</p>
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="mb-1 text-[11px] font-bold uppercase text-slate-500">1. Pointage (CNAME recommandé)</div>
              <table className="text-[12.5px]"><tbody>
                <tr><td className="pr-4 font-semibold">Type</td><td>CNAME</td></tr>
                <tr><td className="pr-4 font-semibold">Nom</td><td><code className="font-mono">{dom.domain}</code></td></tr>
                <tr><td className="pr-4 font-semibold">Valeur</td><td><code className="font-mono">{cnameTarget}</code></td></tr>
              </tbody></table>
              <p className="mt-1 text-[11px] text-slate-500">Pour un domaine racine, utilisez un enregistrement A vers l&apos;IP du serveur, ou préférez un sous-domaine.</p>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="mb-1 text-[11px] font-bold uppercase text-slate-500">2. Vérification de propriété (TXT)</div>
              <table className="text-[12.5px]"><tbody>
                <tr><td className="pr-4 font-semibold">Type</td><td>TXT</td></tr>
                <tr><td className="pr-4 font-semibold">Nom</td><td><code className="font-mono">_gedify-verification.{dom.domain}</code></td></tr>
                <tr><td className="pr-4 font-semibold">Valeur</td><td><code className="font-mono break-all">{dom.verificationToken}</code></td></tr>
              </tbody></table>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Actions">
        <div className="flex flex-wrap items-center gap-2">
          <form action={verifyDnsAction}><input type="hidden" name="id" value={dom.id} /><button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>Vérifier le DNS</button></form>
          {isCustom ? <form action={verifyOwnershipAction}><input type="hidden" name="id" value={dom.id} /><button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>Vérifier la propriété (TXT)</button></form> : null}
          {!dom.isPrimary ? <form action={setPrimaryAction}><input type="hidden" name="id" value={dom.id} /><button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>Définir principal</button></form> : null}
          {dom.status !== "active" ? (
            <form action={toggleDomainAction}><input type="hidden" name="id" value={dom.id} /><input type="hidden" name="enable" value="1" /><button className="h-9 rounded-lg px-3 text-[12px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Activer</button></form>
          ) : (
            <form action={toggleDomainAction}><input type="hidden" name="id" value={dom.id} /><input type="hidden" name="enable" value="0" /><button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>Désactiver</button></form>
          )}
          <form action={deleteDomainAction}><input type="hidden" name="id" value={dom.id} /><button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Supprimer</button></form>
          <a href={`https://${dom.domain}`} target="_blank" rel="noreferrer" className="h-9 rounded-lg border px-3 text-[12px] font-semibold leading-9" style={{ borderColor: "var(--border)" }}>Ouvrir ↗</a>
        </div>
        <p className="mt-3 text-[12px] text-slate-500"><Link href={`/admin/saas/tenants/${dom.tenantId}`} style={{ color: "var(--blue-600)" }}>Ouvrir le tenant →</Link></p>
      </SectionCard>
    </PageShell>
  );
}
