import { Lock, type LucideIcon } from "lucide-react";

type ScopePlaceholderProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
};

/**
 * État propre pour une fonctionnalité Gmail nécessitant des scopes non encore
 * autorisés (brouillons / envoyés / archives / envoi). N'affiche aucun bouton
 * actif : on ne fait jamais semblant que la fonction marche.
 */
export function ScopePlaceholder({ icon: Icon = Lock, title, description }: ScopePlaceholderProps) {
  return (
    <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
      <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(219,39,119,0.08)", color: "#DB2777" }}>
        <Icon className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <p className="mt-3 text-[15px] font-bold" style={{ color: "var(--text-main)" }}>{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[13px]" style={{ color: "var(--text-muted)" }}>{description}</p>
    </div>
  );
}
