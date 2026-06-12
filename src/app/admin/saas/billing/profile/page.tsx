import { AlertTriangle, Building2, MapPin, Receipt, CreditCard, Hash, Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { getDefaultBillingProfile, billingProfileIssues } from "@/lib/saas/billing/profile-store";
import { AdminCard, AdminAlert, AdminInput, AdminSelect, AdminTextarea, AdminButton, AdminFormSection } from "@/components/admin-ui";
import { saveBillingProfileAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { href: "/admin/saas/billing", label: "Facturation" },
  { label: "Profil émetteur" },
];

export default async function BillingProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  const { error, updated } = await searchParams;
  const p = await getDefaultBillingProfile();
  const issues = billingProfileIssues(p);
  const v = (x: string | number | null | undefined) => (x ?? "") as string | number;

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Profil émetteur" description="Informations de l'entreprise émettrice des factures (mentions légales)." />

      {updated ? <AdminAlert tone="success">Profil enregistré.</AdminAlert> : null}
      {error ? <AdminAlert tone="danger">{error}</AdminAlert> : null}
      {issues.length > 0 ? <AdminAlert tone="warning">Profil incomplet : {issues.join(" ")}</AdminAlert> : null}

      <form action={saveBillingProfileAction} className="space-y-4">
        <AdminCard icon={Building2} title="Identité">
          <AdminFormSection columns={3}>
            <AdminInput id="profileName" name="profileName" label="Nom du profil" defaultValue={v(p?.profileName ?? "Profil principal")} />
            <AdminInput id="companyName" name="companyName" label="Société" defaultValue={v(p?.companyName)} />
            <AdminInput id="legalName" name="legalName" label="Raison sociale" defaultValue={v(p?.legalName)} />
            <AdminInput id="legalForm" name="legalForm" label="Forme juridique" defaultValue={v(p?.legalForm)} placeholder="SAS, EI…" />
            <AdminInput id="shareCapital" name="shareCapital" label="Capital social" defaultValue={v(p?.shareCapital)} />
            <AdminInput id="apeNaf" name="apeNaf" label="Code APE/NAF" defaultValue={v(p?.apeNaf)} />
          </AdminFormSection>
        </AdminCard>

        <AdminCard icon={MapPin} title="Adresse & contact">
          <AdminFormSection columns={3}>
            <AdminInput id="addressLine1" name="addressLine1" label="Adresse" defaultValue={v(p?.addressLine1)} />
            <AdminInput id="addressLine2" name="addressLine2" label="Complément" defaultValue={v(p?.addressLine2)} />
            <AdminInput id="postalCode" name="postalCode" label="Code postal" defaultValue={v(p?.postalCode)} />
            <AdminInput id="city" name="city" label="Ville" defaultValue={v(p?.city)} />
            <AdminInput id="country" name="country" label="Pays" defaultValue={v(p?.country ?? "France")} />
            <AdminInput id="email" name="email" type="email" label="Email" defaultValue={v(p?.email)} />
            <AdminInput id="phone" name="phone" label="Téléphone" defaultValue={v(p?.phone)} />
            <AdminInput id="website" name="website" label="Site web" defaultValue={v(p?.website)} />
          </AdminFormSection>
        </AdminCard>

        <AdminCard icon={Scale} title="Fiscalité & immatriculation">
          <AdminFormSection columns={3}>
            <AdminInput id="siren" name="siren" label="SIREN" defaultValue={v(p?.siren)} />
            <AdminInput id="siret" name="siret" label="SIRET" defaultValue={v(p?.siret)} />
            <AdminInput id="vatNumber" name="vatNumber" label="TVA intracom." defaultValue={v(p?.vatNumber)} />
            <AdminInput id="rcsCity" name="rcsCity" label="RCS ville" defaultValue={v(p?.rcsCity)} />
            <AdminInput id="rcsNumber" name="rcsNumber" label="RCS numéro" defaultValue={v(p?.rcsNumber)} />
            <AdminInput id="rmNumber" name="rmNumber" label="RM numéro" defaultValue={v(p?.rmNumber)} />
            <AdminSelect id="vatRegime" name="vatRegime" label="Régime TVA" defaultValue={p?.vatRegime ?? "standard"}>
              <option value="standard">standard</option>
              <option value="franchise_base">franchise en base (293 B)</option>
              <option value="exempt">exonéré</option>
              <option value="reverse_charge">autoliquidation</option>
              <option value="intra_eu">intra-UE</option>
            </AdminSelect>
            <AdminInput id="defaultVatRate" name="defaultVatRate" type="number" label="Taux TVA défaut (%)" defaultValue={v(p?.defaultVatRate)} placeholder="20" />
          </AdminFormSection>
        </AdminCard>

        <AdminCard icon={CreditCard} title="Paiement">
          <AdminFormSection columns={3}>
            <AdminInput id="iban" name="iban" label="IBAN" defaultValue={v(p?.iban)} />
            <AdminInput id="bic" name="bic" label="BIC" defaultValue={v(p?.bic)} />
            <AdminInput id="paymentTermsDays" name="paymentTermsDays" type="number" label="Délai paiement (j)" defaultValue={v(p?.paymentTermsDays ?? 30)} />
            <AdminInput id="latePaymentRate" name="latePaymentRate" label="Taux pénalités retard" defaultValue={v(p?.latePaymentRate)} placeholder="3× taux légal" />
          </AdminFormSection>
        </AdminCard>

        <AdminCard icon={Hash} title="Numérotation">
          <AdminFormSection columns={2}>
            <AdminInput id="invoicePrefix" name="invoicePrefix" label="Préfixe facture" defaultValue={v(p?.invoicePrefix ?? "FAC")} />
            <AdminInput id="creditNotePrefix" name="creditNotePrefix" label="Préfixe avoir" defaultValue={v(p?.creditNotePrefix ?? "AVOIR")} />
          </AdminFormSection>
          {p ? <p className="mt-3 text-[12.5px] text-slate-500">Prochaine facture {p.invoicePrefix}-{new Date().getFullYear()}-{String(p.nextInvoiceNumber).padStart(6, "0")} · prochain avoir {p.creditNotePrefix}-{new Date().getFullYear()}-{String(p.nextCreditNoteNumber).padStart(6, "0")}</p> : null}
        </AdminCard>

        <AdminCard icon={Receipt} title="Mentions légales (optionnel)">
          <AdminTextarea id="legalFooterHtml" name="legalFooterHtml" label="Pied de page légal (HTML — prime sur les mentions auto)" defaultValue={v(p?.legalFooterHtml)} rows={3} />
        </AdminCard>

        <div className="flex justify-end">
          <AdminButton type="submit" variant="primary">Enregistrer le profil</AdminButton>
        </div>
      </form>
    </PageShell>
  );
}
