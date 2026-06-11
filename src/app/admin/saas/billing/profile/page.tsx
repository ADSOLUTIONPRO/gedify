import { AlertTriangle, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getDefaultBillingProfile, billingProfileIssues } from "@/lib/saas/billing/profile-store";
import { saveBillingProfileAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Profil émetteur" },
];
const cls = "h-9 w-full rounded-lg border px-2 text-[13px]";
function F({ label, name, def, type = "text", ph }: { label: string; name: string; def?: string | number | null; type?: string; ph?: string }) {
  return (
    <label className="space-y-1 text-[12px]">
      <span className="font-semibold" style={{ color: "var(--text-main)" }}>{label}</span>
      <input name={name} type={type} defaultValue={def ?? ""} placeholder={ph} className={cls} style={{ borderColor: "var(--border)" }} />
    </label>
  );
}

export default async function BillingProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  const { error, updated } = await searchParams;
  const p = await getDefaultBillingProfile();
  const issues = billingProfileIssues(p);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Profil émetteur" description="Informations de l'entreprise émettrice des factures (mentions légales)." />
      {updated ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Profil enregistré.</div> : null}
      {error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">{error}</div> : null}
      {issues.length > 0 ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <span>Profil incomplet : {issues.join(" ")}</span>
        </div>
      ) : null}

      <SectionCard icon={Building2} title="Émetteur">
        <form action={saveBillingProfileAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Nom du profil" name="profileName" def={p?.profileName ?? "Profil principal"} />
            <F label="Société" name="companyName" def={p?.companyName} />
            <F label="Raison sociale" name="legalName" def={p?.legalName} />
            <F label="Forme juridique" name="legalForm" def={p?.legalForm} ph="SAS, EI…" />
            <F label="SIREN" name="siren" def={p?.siren} />
            <F label="SIRET" name="siret" def={p?.siret} />
            <F label="TVA intracom." name="vatNumber" def={p?.vatNumber} />
            <F label="RCS ville" name="rcsCity" def={p?.rcsCity} />
            <F label="RCS numéro" name="rcsNumber" def={p?.rcsNumber} />
            <F label="Capital social" name="shareCapital" def={p?.shareCapital} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Adresse" name="addressLine1" def={p?.addressLine1} />
            <F label="Complément" name="addressLine2" def={p?.addressLine2} />
            <F label="Code postal" name="postalCode" def={p?.postalCode} />
            <F label="Ville" name="city" def={p?.city} />
            <F label="Pays" name="country" def={p?.country ?? "France"} />
            <F label="Email" name="email" type="email" def={p?.email} />
            <F label="Téléphone" name="phone" def={p?.phone} />
            <F label="IBAN" name="iban" def={p?.iban} />
            <F label="BIC" name="bic" def={p?.bic} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-[12px]">
              <span className="font-semibold" style={{ color: "var(--text-main)" }}>Régime TVA</span>
              <select name="vatRegime" defaultValue={p?.vatRegime ?? "standard"} className={cls} style={{ borderColor: "var(--border)" }}>
                <option value="standard">standard</option>
                <option value="franchise_base">franchise en base (293 B)</option>
                <option value="exempt">exonéré</option>
                <option value="reverse_charge">autoliquidation</option>
                <option value="intra_eu">intra-UE</option>
              </select>
            </label>
            <F label="Taux TVA défaut (%)" name="defaultVatRate" type="number" def={p?.defaultVatRate} ph="20" />
            <F label="Délai paiement (j)" name="paymentTermsDays" type="number" def={p?.paymentTermsDays ?? 30} />
            <F label="Taux pénalités retard" name="latePaymentRate" def={p?.latePaymentRate} ph="3× taux légal" />
            <F label="Préfixe facture" name="invoicePrefix" def={p?.invoicePrefix ?? "FAC"} />
            <F label="Préfixe avoir" name="creditNotePrefix" def={p?.creditNotePrefix ?? "AVOIR"} />
          </div>
          <label className="block space-y-1 text-[12px]">
            <span className="font-semibold" style={{ color: "var(--text-main)" }}>Pied de page légal (HTML, optionnel — prime sur les mentions auto)</span>
            <textarea name="legalFooterHtml" defaultValue={p?.legalFooterHtml ?? ""} rows={3} className="w-full rounded-lg border p-2 text-[13px]" style={{ borderColor: "var(--border)" }} />
          </label>
          <button type="submit" className="h-10 rounded-xl px-5 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Enregistrer</button>
        </form>
      </SectionCard>
      {p ? <p className="text-[12px] text-slate-500">Numérotation : prochaine facture {p.invoicePrefix}-{new Date().getFullYear()}-{String(p.nextInvoiceNumber).padStart(6, "0")} · prochain avoir {p.creditNotePrefix}-{new Date().getFullYear()}-{String(p.nextCreditNoteNumber).padStart(6, "0")}</p> : null}
    </PageShell>
  );
}
