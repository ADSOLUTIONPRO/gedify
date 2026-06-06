import type { ReactNode } from "react";
import Link from "next/link";
import { Lock, Settings } from "lucide-react";
import { getGedifyFeatureFlags } from "@/lib/settings/feature-flags";

export const dynamic = "force-dynamic";

/**
 * Garde d'accès de l'espace Finances. Si le module est désactivé dans
 * « Paramètres › Modules et automatisations », on affiche un message clair au
 * lieu du contenu — SANS supprimer la moindre donnée financière (réactivable).
 */
export default async function FinancesLayout({ children }: { children: ReactNode }) {
  const flags = await getGedifyFeatureFlags();
  if (flags.financeSpaceEnabled) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl border bg-white p-8 text-center"
        style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <span
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(11,92,255,0.08)", color: "#0B5CFF" }}
        >
          <Lock className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h1 className="text-[18px] font-extrabold" style={{ color: "var(--text-main)" }}>
          L&apos;espace Finances est désactivé
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Ce module est désactivé dans vos paramètres. Vos données financières sont
          conservées : vous pouvez le réactiver à tout moment.
        </p>
        <Link
          href="/parametres"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl px-5 text-[13.5px] font-bold text-white transition hover:opacity-90"
          style={{ background: "#0B5CFF" }}
        >
          <Settings className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
          Ouvrir les paramètres
        </Link>
      </div>
    </div>
  );
}
