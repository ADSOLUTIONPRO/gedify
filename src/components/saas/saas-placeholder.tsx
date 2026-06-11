import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";

/**
 * Page placeholder PROPRE pour les sections SaaS pas encore fonctionnelles
 * (badge « Bientôt »). Évite tout lien mort dans le menu « Gestion clients ».
 */
export function SaasPlaceholder({
  title,
  label,
  icon,
  description,
  bullets,
  soon = true,
}: {
  title: string;
  label: string;
  icon: LucideIcon;
  description: string;
  bullets?: string[];
  soon?: boolean;
}) {
  const breadcrumb = [
    { href: "/dashboard", label: "Accueil" },
    { href: "/admin/saas", label: "Gestion clients" },
    { label },
  ];
  return (
    <PageShell>
      <PageHeader
        breadcrumb={breadcrumb}
        title={title}
        description={description}
        actions={
          soon ? (
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide"
              style={{ background: "#FEF3C7", color: "#92400E" }}
            >
              Bientôt
            </span>
          ) : null
        }
      />
      <SectionCard icon={icon} title={title}>
        <p className="text-sm text-slate-600">{description}</p>
        {bullets && bullets.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-slate-600">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        {soon ? (
          <p className="mt-4 text-[12px] text-slate-500">
            Section en préparation — l&apos;interface arrivera dans une prochaine étape.
          </p>
        ) : null}
      </SectionCard>
    </PageShell>
  );
}
