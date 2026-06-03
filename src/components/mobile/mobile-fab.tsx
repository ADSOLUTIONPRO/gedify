"use client";

import Link from "next/link";
import { Plus, type LucideIcon } from "lucide-react";

type Props = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
};

/**
 * Bouton d'action flottant (FAB) rose plein — app mobile (< md), fixé
 * au-dessus de la barre de navigation basse. Lien (`href`) ou bouton (`onClick`).
 */
export function MobileFab({ label, href, onClick, icon: Icon = Plus }: Props) {
  const className =
    "fixed right-4 z-40 inline-flex h-[52px] items-center gap-2 rounded-full px-5 text-[14px] font-bold text-white shadow-lg transition hover:opacity-90 active:scale-[0.98] md:hidden";
  const style = {
    background: "var(--accent)",
    bottom: "calc(env(safe-area-inset-bottom) + 70px)",
  } as const;

  const content = (
    <>
      <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} style={style} aria-label={label}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style} aria-label={label}>
      {content}
    </button>
  );
}
