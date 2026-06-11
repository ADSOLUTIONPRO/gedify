import Link from "next/link";
import {
  AlertTriangle, Banknote, Building2, CreditCard, Globe, LifeBuoy, Mail, Settings2, ShieldCheck, ToggleRight, UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSaasSettings } from "@/lib/saas/settings";
import { areEmailsEnabled, getAppEnv } from "@/lib/config/environment";
import { isStripeEnabled, getStripeConfigStatus } from "@/lib/saas/stripe/config";
import { getMasterKeyStatus } from "@/lib/saas/encryption/master-key";
import {
  saveSignupAction, saveUrlsAction, saveEmailsAction, saveLimitsAction, savePaymentAction,
  saveSecurityAction, saveSupportAction, saveBillingDefaultsAction, saveTrialsAction, saveFeaturesAction,
} from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Paramètres SaaS" },
];
const inp = "h-9 w-full rounded-lg border px-2 text-[13px]";
const bd = { borderColor: "var(--border)" };

function Bool({ name, def, label }: { name: string; def: boolean; label: string }) {
  return (
    <label className="space-y-1 text-[12px]">
      <span className="font-semibold" style={{ color: "var(--text-main)" }}>{label}</span>
      <select name={name} defaultValue={def ? "1" : "0"} className={inp} style={bd}><option value="1">Oui</option><option value="0">Non</option></select>
    </label>
  );
}
function Txt({ name, def, label, type = "text", ph }: { name: string; def: string | number; label: string; type?: string; ph?: string }) {
  return (
    <label className="space-y-1 text-[12px]">
      <span className="font-semibold" style={{ color: "var(--text-main)" }}>{label}</span>
      <input name={name} type={type} defaultValue={def} placeholder={ph} className={inp} style={bd} />
    </label>
  );
}
function Save() {
  return <button className="mt-3 h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Enregistrer</button>;
}
function EnvBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={ok ? { background: "#DCFCE7", color: "#15803D" } : { background: "#F1F5F9", color: "#64748b" }}>
      {label} {ok ? "✓" : "—"}
    </span>
  );
}

export default async function SaasSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Paramètres SaaS" /><SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Paramètres SaaS" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const s = await getSaasSettings();
  const stripe = getStripeConfigStatus();
  const master = getMasterKeyStatus();
  const appEnv = getAppEnv();
  const envBadge = <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">variable d&apos;environnement</span>;

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Paramètres SaaS" description="Configuration globale de la plateforme (superuser). Les secrets restent en variables d'environnement." />
      {sp.saved ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Section « {sp.saved} » enregistrée.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}
      {s.security.maintenanceMode ? <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" /> Mode maintenance ACTIF.</div> : null}

      <SectionCard icon={ToggleRight} title="Fonctionnalités globales (interrupteur supérieur)">
        <p className="mb-3 text-[12px] text-slate-500">Si une fonctionnalité est coupée ici, <strong>aucun plan</strong> ne peut l&apos;utiliser, même s&apos;il l&apos;autorise.</p>
        <form action={saveFeaturesAction}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Bool name="ai" def={s.features.ai} label="IA globale" />
            <Bool name="ocr" def={s.features.ocr} label="OCR global" />
            <Bool name="emailImport" def={s.features.emailImport} label="Import email" />
            <Bool name="onlyoffice" def={s.features.onlyoffice} label="OnlyOffice" />
            <Bool name="mailing" def={s.features.mailing} label="Mailing" />
            <Bool name="support" def={s.features.support} label="Support" />
            <Bool name="marketingCampaigns" def={s.features.marketingCampaigns} label="Campagnes marketing" />
            <Bool name="publicSignup" def={s.features.publicSignup} label="Inscriptions publiques" />
          </div>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={UserPlus} title="Inscriptions & accès">
        <form action={saveSignupAction}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Bool name="publicSignupEnabled" def={s.signup.publicSignupEnabled} label="Inscription publique" />
            <Bool name="inviteOnly" def={s.signup.inviteOnly} label="Sur invitation seule" />
            <Bool name="requireEmailVerification" def={s.signup.requireEmailVerification} label="Vérif. email obligatoire" />
            <Bool name="requireAdminApproval" def={s.signup.requireAdminApproval} label="Validation manuelle" />
            <Bool name="autoCreateTenant" def={s.signup.autoCreateTenant} label="Créer tenant auto" />
            <Txt name="defaultPlan" def={s.signup.defaultPlan} label="Plan par défaut" />
            <Bool name="demoTenantAllowed" def={s.signup.demoTenantAllowed} label="Tenant démo autorisé" />
          </div>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={Globe} title="Domaine & URLs">
        <form action={saveUrlsAction}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Txt name="primaryDomain" def={s.urls.primaryDomain} label="Domaine principal" />
            <Bool name="subdomainsEnabled" def={s.urls.subdomainsEnabled} label="Sous-domaines clients" />
            <Bool name="customDomainsEnabled" def={s.urls.customDomainsEnabled} label="Domaines personnalisés" />
            <Txt name="supportUrl" def={s.urls.supportUrl} label="URL support" />
            <Txt name="termsUrl" def={s.urls.termsUrl} label="URL CGU" />
            <Txt name="privacyUrl" def={s.urls.privacyUrl} label="URL confidentialité" />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">URL publique app {envBadge} : <code className="font-mono">{process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "—"}</code> · environnement : <strong>{appEnv}</strong></p>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={Mail} title="E-mails système">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <EnvBadge label="EMAILS_ENABLED" ok={areEmailsEnabled()} />
          <Link href="/admin/saas/mailing" className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>Configuration SMTP →</Link>
        </div>
        <form action={saveEmailsAction}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Txt name="fromName" def={s.emails.fromName} label="Nom expéditeur" />
            <Txt name="noreplyEmail" def={s.emails.noreplyEmail} label="Email no-reply" type="email" />
            <Txt name="supportEmail" def={s.emails.supportEmail} label="Email support" type="email" />
            <Txt name="billingEmail" def={s.emails.billingEmail} label="Email facturation" type="email" />
            <Txt name="contactEmail" def={s.emails.contactEmail} label="Email contact" type="email" />
          </div>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={Settings2} title="Limites par défaut">
        <form action={saveLimitsAction}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Txt name="maxUsers" def={s.limits.maxUsers} label="Max utilisateurs" type="number" />
            <Txt name="maxDocuments" def={s.limits.maxDocuments} label="Max documents" type="number" />
            <Txt name="maxStorageMb" def={s.limits.maxStorageMb} label="Max stockage (Mo)" type="number" />
            <Txt name="maxUploadMb" def={s.limits.maxUploadMb} label="Taille max upload (Mo)" type="number" />
            <Txt name="maxTestTenants" def={s.limits.maxTestTenants} label="Max tenants test" type="number" />
            <Txt name="maxPendingInvitations" def={s.limits.maxPendingInvitations} label="Max invitations" type="number" />
            <Txt name="trialDays" def={s.limits.trialDays} label="Durée essai (j)" type="number" />
          </div>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={CreditCard} title="Politique paiement / non-paiement">
        <form action={savePaymentAction}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Txt name="graceDays" def={s.payment.graceDays} label="Délai de grâce (j)" type="number" />
            <Txt name="premiumRestrictDays" def={s.payment.premiumRestrictDays} label="Restriction premium (j)" type="number" />
            <Txt name="uploadBlockDays" def={s.payment.uploadBlockDays} label="Blocage uploads (j)" type="number" />
            <Txt name="suspendDays" def={s.payment.suspendDays} label="Suspension tenant (j)" type="number" />
            <Bool name="autoRemindersEnabled" def={s.payment.autoRemindersEnabled} label="Relances auto" />
            <Txt name="maxReminders" def={s.payment.maxReminders} label="Nb max relances" type="number" />
          </div>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Sécurité SaaS">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <EnvBadge label="ENCRYPTION_MASTER_KEY" ok={master.valid} />
          <Link href="/admin/saas/encryption" className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>Chiffrement →</Link>
        </div>
        <form action={saveSecurityAction}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Bool name="require2fa" def={s.security.require2fa} label="2FA obligatoire (futur)" />
            <Txt name="sessionDurationHours" def={s.security.sessionDurationHours} label="Durée session (h)" type="number" />
            <Bool name="bruteForceProtection" def={s.security.bruteForceProtection} label="Anti brute-force" />
            <Bool name="auditLogsEnabled" def={s.security.auditLogsEnabled} label="Journaux d'audit" />
            <Bool name="maintenanceMode" def={s.security.maintenanceMode} label="Mode maintenance" />
          </div>
          <label className="mt-2 flex items-center gap-2 text-[12px] text-amber-800"><input type="checkbox" name="confirm" value="1" /> Je confirme l&apos;activation du mode maintenance (si sélectionné ci-dessus).</label>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={LifeBuoy} title="Support client">
        <form action={saveSupportAction}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Bool name="humanSupportEnabled" def={s.support.humanSupportEnabled} label="Support humain" />
            <Bool name="chatEnabled" def={s.support.chatEnabled} label="Chat conseiller" />
            <Bool name="ticketsEnabled" def={s.support.ticketsEnabled} label="Tickets" />
            <Bool name="attachmentsEnabled" def={s.support.attachmentsEnabled} label="Pièces jointes" />
            <Txt name="maxAttachmentMb" def={s.support.maxAttachmentMb} label="Max PJ (Mo)" type="number" />
            <Txt name="hours" def={s.support.hours} label="Horaires" />
          </div>
          <label className="mt-3 block space-y-1 text-[12px]"><span className="font-semibold">Message d&apos;accueil</span><input name="welcomeMessage" defaultValue={s.support.welcomeMessage} className={inp} style={bd} /></label>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={Building2} title="Facturation (valeurs par défaut)">
        <div className="mb-3 flex flex-wrap gap-3">
          <Link href="/admin/saas/billing/profile" className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>Profil émetteur →</Link>
          <Link href="/admin/saas/billing/templates" className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>Modèles facture →</Link>
        </div>
        <form action={saveBillingDefaultsAction}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Txt name="invoicePrefix" def={s.billing.invoicePrefix} label="Préfixe facture" />
            <Txt name="creditNotePrefix" def={s.billing.creditNotePrefix} label="Préfixe avoir" />
            <Txt name="paymentTermsDays" def={s.billing.paymentTermsDays} label="Délai paiement (j)" type="number" />
            <Txt name="defaultVatRate" def={s.billing.defaultVatRate} label="TVA par défaut (%)" type="number" />
            <Txt name="currency" def={s.billing.currency} label="Devise" />
          </div>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={Settings2} title="Périodes d'essai">
        <form action={saveTrialsAction}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Txt name="defaultPlan" def={s.trials.defaultPlan} label="Plan d'essai" />
            <Txt name="fallbackPlan" def={s.trials.fallbackPlan} label="Plan de repli" />
            <Txt name="suspendAfterDays" def={s.trials.suspendAfterDays} label="Suspension après (j)" type="number" />
            <Bool name="allowManualExtension" def={s.trials.allowManualExtension} label="Prolongation manuelle" />
            <Bool name="reminder7d" def={s.trials.reminder7d} label="Relance J-7" />
            <Bool name="reminder3d" def={s.trials.reminder3d} label="Relance J-3" />
            <Bool name="reminder1d" def={s.trials.reminder1d} label="Relance J-1" />
            <Bool name="restrictPremiumAfter" def={s.trials.restrictPremiumAfter} label="Restreindre premium après" />
          </div>
          <Save />
        </form>
      </SectionCard>

      <SectionCard icon={Banknote} title="Stripe (lecture seule — variables d'environnement)">
        <div className="flex flex-wrap items-center gap-2">
          <EnvBadge label="STRIPE_ENABLED" ok={isStripeEnabled()} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">mode : {stripe.mode}</span>
          <EnvBadge label="Secret key" ok={stripe.secretKeyPresent} />
          <EnvBadge label="Webhook secret" ok={stripe.webhookSecretPresent} />
          <Link href="/admin/saas/stripe" className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>Page Stripe →</Link>
        </div>
        {appEnv === "staging" ? <p className="mt-2 text-[11px] text-amber-700">En staging, le mode <strong>live</strong> est refusé par sécurité.</p> : null}
      </SectionCard>
    </PageShell>
  );
}
