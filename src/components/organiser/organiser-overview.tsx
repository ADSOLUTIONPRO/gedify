import Link from "next/link";
import { AlertTriangle, FileType2, FolderTree, PiggyBank, Tag, Users, type LucideIcon } from "lucide-react";
import { OrganiserCard } from "@/components/organiser/organiser-card";
import { OrganiserSearch, type ReferentialEntry } from "@/components/organiser/organiser-search";
import {
  RecentOrganisationActivity,
  type OrganisationActivityItem,
} from "@/components/organiser/recent-organisation-activity";

export type OrganiserCounts = {
  types: number;
  tags: number;
  correspondents: number;
  projects: number;
};

export type CleanupHint = {
  label: string;
  count: number;
  href: string;
};

type OrganiserOverviewProps = {
  counts: OrganiserCounts;
  cleanup: CleanupHint[];
  activity: OrganisationActivityItem[];
  entries: ReferentialEntry[];
};

const CARD_ICON: Record<string, LucideIcon> = {
  types: FileType2,
  tags: Tag,
  correspondents: Users,
  projects: FolderTree,
};

/**
 * Vue d'ensemble de l'espace Organiser : recherche globale, cartes principales
 * (Types/Tags/Correspondants/Dossiers), zone « À corriger » et dernières
 * modifications.
 */
export function OrganiserOverview({ counts, cleanup, activity, entries }: OrganiserOverviewProps) {
  void PiggyBank;
  return (
    <div className="space-y-5">
      <OrganiserSearch entries={entries} />

      {/* Cartes principales */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OrganiserCard title="Types" count={counts.types} description="Nature des documents" color="#0B5CFF" icon={CARD_ICON.types} href="/organiser/types" />
        <OrganiserCard title="Tags" count={counts.tags} description="Sujets et étiquettes" color="#7C3AED" icon={CARD_ICON.tags} href="/organiser/tags" />
        <OrganiserCard title="Correspondants" count={counts.correspondents} description="Émetteurs et destinataires" color="#16A34A" icon={CARD_ICON.correspondents} href="/organiser/correspondants" />
        <OrganiserCard title="Dossiers / Projets" count={counts.projects} description="Affaires et sujets" color="#F97316" icon={CARD_ICON.projects} href="/organiser/dossiers" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* À corriger */}
        <section className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              À corriger
            </p>
            <Link href="/organiser/nettoyage" className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>
              Tout voir
            </Link>
          </div>
          {cleanup.length === 0 ? (
            <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Rien à corriger pour le moment. 🎉
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {cleanup.map((hint) => (
                <li key={hint.label}>
                  <Link
                    href={hint.href}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[13px] transition hover:bg-slate-50"
                  >
                    <span className="font-medium" style={{ color: "var(--text-main)" }}>
                      {hint.label}
                    </span>
                    <span
                      className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: "rgba(245,158,11,0.12)", color: "#B45309" }}
                    >
                      {hint.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Dernières modifications */}
        <RecentOrganisationActivity items={activity} />
      </div>
    </div>
  );
}
