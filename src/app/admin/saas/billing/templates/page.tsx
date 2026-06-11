import { LayoutTemplate, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { href: "/admin/saas/billing", label: "Facturation" },
  { label: "Modèles" },
];

async function listTemplates(): Promise<Record<string, unknown>[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM invoice_templates ORDER BY is_default DESC, name");
    return rows;
  } catch {
    return [];
  }
}

export default async function InvoiceTemplatesPage() {
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Modèles" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const templates = await listTemplates();

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Modèles de facture" description="Gabarits de mise en page des factures PDF/HTML." />

      <SectionCard icon={LayoutTemplate} title="Modèle intégré">
        <p className="text-sm text-slate-600">
          Un gabarit par défaut (A4, en-tête émetteur, parties, tableau de lignes, totaux et pied de page légal) est appliqué automatiquement
          à toutes les factures. Les coordonnées et mentions proviennent du <span className="font-semibold">profil émetteur</span> et sont figées
          dans la facture au moment de l&apos;émission.
        </p>
      </SectionCard>

      {templates.length > 0 ? (
        <SectionCard icon={LayoutTemplate} title={`Modèles personnalisés (${templates.length})`} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Nom</th><th className="px-4 py-2">Locale</th><th className="px-4 py-2">Devise</th><th className="px-4 py-2">Défaut</th>
              </tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={String(t.id)} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2 font-semibold">{String(t.name)}</td>
                    <td className="px-4 py-2">{String(t.locale ?? "fr-FR")}</td>
                    <td className="px-4 py-2">{String(t.currency ?? "EUR")}</td>
                    <td className="px-4 py-2">{t.is_default ? "Oui" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </PageShell>
  );
}
