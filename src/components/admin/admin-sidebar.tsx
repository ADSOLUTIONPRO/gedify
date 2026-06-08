"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Bot, Database, DatabaseBackup, Download, FileText, Gauge, HardDrive,
  HeartPulse, HelpCircle, LayoutDashboard, ListChecks, Lock, Palette, Plug,
  RefreshCw, ScrollText, Settings, ShieldCheck, SlidersHorizontal, Users, Wrench, Workflow,
} from "lucide-react";

/* Sidebar de gouvernance de l'Administration (façon maquette proposition-1) :
   « Vue d'ensemble » + groupes de liens vers les vraies pages d'admin. */

type Item = { href: string; label: string; icon: typeof Settings };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Gouvernance & sécurité",
    items: [
      { href: "/utilisateurs", label: "Utilisateurs & accès", icon: Users },
      { href: "/administration/roles", label: "Groupes & rôles", icon: ShieldCheck },
      { href: "/journaux", label: "Audit & journaux", icon: ScrollText },
      { href: "/statut", label: "Sécurité & conformité", icon: Lock },
    ],
  },
  {
    title: "Configuration système",
    items: [
      { href: "/administration/parametres", label: "Paramètres généraux", icon: Settings },
      { href: "/administration/sante", label: "Stockage & fichiers", icon: HardDrive },
      { href: "/administration/sauvegarde", label: "Sauvegardes & restauration", icon: DatabaseBackup },
      { href: "/administration/mises-a-jour", label: "Mises à jour", icon: RefreshCw },
      { href: "/statut", label: "Licences & informations", icon: FileText },
    ],
  },
  {
    title: "Infrastructure & services",
    items: [
      { href: "/administration/sante", label: "Santé système", icon: HeartPulse },
      { href: "/emails", label: "Services & connecteurs", icon: Plug },
      { href: "/administration/sante", label: "Bases de données", icon: Database },
      { href: "/administration/doublons", label: "Doublons & intégrité", icon: ListChecks },
      { href: "/statut", label: "Performances", icon: Gauge },
    ],
  },
  {
    title: "Personnalisation avancée",
    items: [
      { href: "/organiser", label: "Champs & taxonomies", icon: SlidersHorizontal },
      { href: "/workflows", label: "Automatisations globales", icon: Workflow },
      { href: "/administration/modeles-ia", label: "Modèles IA & formats", icon: Bot },
      { href: "/administration/parametres", label: "Thèmes & apparence", icon: Palette },
    ],
  },
  {
    title: "Support & maintenance",
    items: [
      { href: "/administration/sante", label: "Diagnostics", icon: Activity },
      { href: "/administration/sauvegarde", label: "Exports techniques", icon: Download },
      { href: "/administration#maintenance", label: "Outils de maintenance", icon: Wrench },
      { href: "/statut", label: "Centre d'aide", icon: HelpCircle },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav className="space-y-4">
      <Link
        href="/administration"
        className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 text-[14px] font-extrabold transition"
        style={pathname === "/administration" ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-main)" }}
      >
        <LayoutDashboard className="h-4.5 w-4.5 shrink-0" strokeWidth={2} aria-hidden="true" /> Vue d&apos;ensemble
      </Link>

      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-3 text-[10.5px] font-extrabold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{g.title}</p>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const active = pathname === it.href.split("#")[0] && pathname !== "/administration";
              return (
                <Link
                  key={it.label}
                  href={it.href}
                  className="flex min-h-[36px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)]"
                  style={active ? { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-main)" } : { color: "var(--text-muted)" }}
                >
                  <it.icon className="h-4 w-4 shrink-0" strokeWidth={1.85} style={{ color: active ? "var(--accent)" : "var(--text-hint)" }} aria-hidden="true" />
                  <span className="truncate">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
