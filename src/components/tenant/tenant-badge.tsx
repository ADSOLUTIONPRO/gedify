import Link from "next/link";
import { Building2, ChevronsUpDown } from "lucide-react";
import type { TenantNav } from "@/lib/tenant/get-current-tenant";

/**
 * Bandeau slim « espace courant » (multi-tenant uniquement). Affiche
 * « Nom · rôle » et, si l'utilisateur a plusieurs espaces, un lien « Changer
 * d'espace » vers /select-tenant. Rien en mono-tenant.
 */
export function TenantBadge({ nav }: { nav: TenantNav }) {
  if (!nav.multiTenant) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-1 text-[12px]"
      style={{ background: "var(--bg-card-soft)", borderBottom: "1px solid var(--border-soft)", color: "var(--text-muted)" }}
    >
      <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden="true" />
      {nav.tenant ? (
        <span className="font-semibold" style={{ color: "var(--text-main)" }}>
          {nav.tenant.name ?? nav.tenant.slug}
          {nav.role ? <span className="font-normal" style={{ color: "var(--text-muted)" }}> · {nav.role}</span> : null}
        </span>
      ) : (
        <span>Aucun espace sélectionné</span>
      )}
      {nav.accessibleCount > 1 ? (
        <Link
          href="/select-tenant"
          className="ml-2 inline-flex items-center gap-1 font-semibold"
          style={{ color: "var(--accent)" }}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Changer d&apos;espace
        </Link>
      ) : null}
    </div>
  );
}
