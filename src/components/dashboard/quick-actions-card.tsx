import Link from "next/link";
import { ChevronRight, FilePlus2, Mail, Sparkles, Upload, type LucideIcon } from "lucide-react";

type QuickAction = { icon: LucideIcon; title: string; subtitle: string; href: string };

const ACTIONS: QuickAction[] = [
  { icon: FilePlus2, title: "Nouveau document", subtitle: "Créer et déposer un document", href: "/import" },
  { icon: Mail, title: "Nouveau message", subtitle: "Écrire un message", href: "/messagerie" },
  { icon: Upload, title: "Importer un fichier", subtitle: "Depuis votre ordinateur", href: "/import" },
  { icon: Sparkles, title: "Analyse IA", subtitle: "Interroger vos documents", href: "/ia" },
];

/**
 * Carte « Actions rapides » (flat) : lignes rose doux, icône + chevron rose.
 * Le rose est réservé à ces actions clés. Responsive : liste verticale
 * (smartphone + desktop) / bande de 4 tuiles (tablette portrait).
 */
export function QuickActionsCard() {
  return (
    <section className="rounded-[22px] bg-white p-4 sm:p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <h2 className="text-[15px] font-extrabold" style={{ color: "var(--gedify-navy)" }}>
        Actions rapides
      </h2>

      {/* Liste verticale (rail) */}
      <div className="mt-4 space-y-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isIA = action.href === "/ia";
          return (
            <Link
              key={action.title}
              href={action.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${isIA ? "hover:brightness-105" : "hover:bg-[#FBDFEA]"}`}
              style={isIA ? { background: "linear-gradient(135deg, #F75C8D 0%, #A855F7 54%, #7C3AED 100%)", boxShadow: "0 6px 18px rgba(124,58,237,0.22)" } : { background: "var(--accent-soft)" }}
            >
              <Icon className="h-5 w-5 shrink-0" style={{ color: isIA ? "#fff" : "var(--accent)" }} strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold" style={{ color: isIA ? "#fff" : "var(--text-main)" }}>
                  {action.title}
                </span>
                <span className="block truncate text-[11.5px]" style={{ color: isIA ? "rgba(255,255,255,0.85)" : "var(--text-muted)" }}>
                  {action.subtitle}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: isIA ? "#fff" : "var(--accent)" }} strokeWidth={2} aria-hidden="true" />
            </Link>
          );
        })}
      </div>

      {/* Bande de 4 tuiles : repli (non utilisé dans le rail) */}
      <div className="mt-4 hidden grid-cols-4 gap-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isIA = action.href === "/ia";
          return (
            <Link
              key={action.title}
              href={action.href}
              className={`flex min-w-0 flex-col items-start gap-2 rounded-xl p-3 transition ${isIA ? "hover:brightness-105" : "hover:bg-[#FBDFEA]"}`}
              style={isIA ? { background: "linear-gradient(135deg, #F75C8D 0%, #A855F7 54%, #7C3AED 100%)", boxShadow: "0 6px 18px rgba(124,58,237,0.22)" } : { background: "var(--accent-soft)" }}
            >
              <Icon className="h-5 w-5 shrink-0" style={{ color: isIA ? "#fff" : "var(--accent)" }} strokeWidth={2} aria-hidden="true" />
              <span className="block w-full truncate text-[12.5px] font-bold leading-tight" style={{ color: isIA ? "#fff" : "var(--text-main)" }}>
                {action.title}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
