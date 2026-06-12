import { Home, ShieldCheck, BadgeCheck, type LucideIcon } from "lucide-react";

/* Bandeau « éléments rassurants » sous la carte d'authentification. */

type Badge = { icon: LucideIcon; title: string; sub: string };

const BADGES: Badge[] = [
  { icon: Home, title: "Hébergé en France", sub: "Données stockées en France" },
  { icon: ShieldCheck, title: "Sécurité renforcée", sub: "Chiffrement AES-256" },
  { icon: BadgeCheck, title: "Conforme RGPD", sub: "Respect de la vie privée" },
];

export function TrustBadges() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {BADGES.map((b) => (
        <div key={b.title} className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <b.icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>{b.title}</span>
            <span className="block text-[11.5px]" style={{ color: "var(--text-muted)" }}>{b.sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
