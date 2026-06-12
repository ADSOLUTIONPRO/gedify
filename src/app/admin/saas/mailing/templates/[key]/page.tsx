import Link from "next/link";
import { LayoutTemplate, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTemplate, variantsOf } from "@/lib/saas/mailing/template-store";
import { MailTemplateEditor, type VarCategory } from "@/components/saas/mail-template-editor";
import { saveTemplateContentAction, sendTestForKeyAction } from "./actions";

export const dynamic = "force-dynamic";

const VARIABLES: VarCategory[] = [
  { category: "App", keys: ["appName", "appUrl"] },
  { category: "Tenant", keys: ["tenantName"] },
  { category: "Utilisateur", keys: ["recipientName", "user.email"] },
  { category: "Abonnement", keys: ["planName", "trialEnd", "nextBillingDate"] },
  { category: "Facture", keys: ["invoiceNumber", "amount", "dueDate", "invoiceUrl"] },
  { category: "Paiement", keys: ["amount", "billingUrl"] },
  { category: "Support", keys: ["ticketRef", "conversationUrl"] },
];

export default async function MailTemplateEditorPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string>> }) {
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const sp = await searchParams;
  const breadcrumb = [
    { href: "/dashboard", label: "Accueil" },
    { href: "/admin/saas/mailing", label: "Mailing" },
    { href: "/admin/saas/mailing/templates", label: "Modèles" },
    { label: key },
  ];
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Modèle d'email" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const tpl = await getTemplate(key);
  if (!tpl) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Introuvable" /><SectionCard icon={LayoutTemplate} title="Introuvable"><p className="text-sm text-slate-600">Modèle inexistant. <Link href="/admin/saas/mailing/templates" style={{ color: "var(--blue-600)" }}>Retour</Link></p></SectionCard></PageShell>;
  }
  const variants = variantsOf(tpl);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title={`Éditeur — ${tpl.name}`} description={`Clé ${tpl.key} · éditeur responsive (Desktop / Tablette / Smartphone).`} />
      {sp.saved ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Modèle enregistré (variantes responsive).</div> : null}
      {sp.test ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Email de test mis en file / envoyé selon EMAILS_ENABLED.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">Erreur lors de l&apos;opération.</div> : null}

      <MailTemplateEditor
        templateKey={tpl.key}
        name={tpl.name}
        initialSubject={tpl.subject}
        initialPreheader={tpl.preheader ?? ""}
        initialVariants={variants}
        variables={VARIABLES}
        saveAction={saveTemplateContentAction}
        sendTestAction={sendTestForKeyAction}
      />
    </PageShell>
  );
}
