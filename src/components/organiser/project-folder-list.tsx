"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, FolderTree, Plus, Tag, Users } from "lucide-react";
import { ResponsiveDetailPanel } from "@/components/layout/responsive-detail-panel";
import { StatusPill } from "@/components/ui/status-pill";

export type ProjectFolderVM = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  color: string;
  documents: number;
  correspondents: number;
  tags: number;
  dueLabel: string | null;
  updatedLabel: string;
  href: string;
};

type Filter = "actifs" | "recents" | "archives" | "sans-document" | "en-attente";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "recents", label: "Récents" },
  { id: "actifs", label: "Actifs" },
  { id: "en-attente", label: "Action en attente" },
  { id: "sans-document", label: "Sans document" },
  { id: "archives", label: "Archivés" },
];

const PENDING = new Set(["À traiter", "En attente", "Important"]);
const ARCHIVED = new Set(["Archivé", "Terminé"]);

function statusTone(status: string): "emerald" | "amber" | "slate" | "rose" {
  if (ARCHIVED.has(status)) return "slate";
  if (status === "Important") return "rose";
  if (PENDING.has(status)) return "amber";
  return "emerald";
}

type ProjectFolderListProps = {
  folders: ProjectFolderVM[];
};

/** Liste des dossiers / projets avec filtres rapides et panneau de détail. */
export function ProjectFolderList({ folders }: ProjectFolderListProps) {
  const [filter, setFilter] = useState<Filter>("recents");
  const [activeId, setActiveId] = useState<string | null>(folders[0]?.id ?? null);

  const filtered = useMemo(() => {
    switch (filter) {
      case "actifs":
        return folders.filter((f) => !ARCHIVED.has(f.status));
      case "archives":
        return folders.filter((f) => ARCHIVED.has(f.status));
      case "sans-document":
        return folders.filter((f) => f.documents === 0);
      case "en-attente":
        return folders.filter((f) => PENDING.has(f.status));
      default:
        return folders;
    }
  }, [folders, filter]);

  const active = filtered.find((f) => f.id === activeId) ?? filtered[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="h-8 rounded-lg border px-3 text-[12.5px] font-semibold transition"
                style={
                  on
                    ? { background: "rgba(249,115,22,0.10)", borderColor: "#F97316", color: "#C2410C" }
                    : { borderColor: "var(--border)", color: "var(--text-muted)" }
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <Link
          href="/dossiers/nouveau"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white transition hover:opacity-90"
          style={{ background: "#F97316" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Nouveau dossier
        </Link>
      </div>

      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
            {filtered.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
                  Aucun dossier
                </p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
                  Créez un dossier pour regrouper documents, correspondants et actions.
                </p>
              </div>
            ) : (
              filtered.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveId(f.id)}
                  className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition last:border-b-0 hover:bg-slate-50"
                  style={{
                    borderColor: "var(--border)",
                    background: f.id === active?.id ? "rgba(249,115,22,0.05)" : undefined,
                    boxShadow: f.id === active?.id ? "inset 2px 0 0 #F97316" : undefined,
                  }}
                >
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${f.color}1a`, color: f.color }}>
                    <FolderTree className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>
                      {f.name}
                    </span>
                    <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                      {f.category} · {f.documents} doc. · maj {f.updatedLabel}
                    </span>
                  </span>
                  <StatusPill tone={statusTone(f.status)} dot>
                    {f.status}
                  </StatusPill>
                </button>
              ))
            )}
          </div>
        </div>

        {filtered.length > 0 && active ? (
          <ResponsiveDetailPanel title="Détail">
            <div className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${active.color}1a`, color: active.color }}>
                  <FolderTree className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>
                    {active.name}
                  </h2>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {active.category} · {active.status}
                  </p>
                </div>
              </div>

              {active.description ? (
                <p className="text-[13px] leading-snug" style={{ color: "var(--text-muted)" }}>
                  {active.description}
                </p>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: FileText, label: "Documents", value: active.documents },
                  { icon: Users, label: "Contacts", value: active.correspondents },
                  { icon: Tag, label: "Tags", value: active.tags },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border px-2 py-2 text-center" style={{ borderColor: "var(--border)" }}>
                    <s.icon className="mx-auto h-4 w-4" style={{ color: "var(--text-muted)" }} strokeWidth={1.75} aria-hidden="true" />
                    <p className="mt-1 text-base font-extrabold" style={{ color: "var(--text-main)" }}>
                      {s.value}
                    </p>
                    <p className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {active.dueLabel ? (
                <div className="rounded-xl border px-3 py-2 text-[12.5px]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                  Échéance : <span className="font-semibold">{active.dueLabel}</span>
                </div>
              ) : null}

              <Link
                href={active.href}
                className="flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#F97316" }}
              >
                Ouvrir le dossier
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          </ResponsiveDetailPanel>
        ) : null}
      </div>
    </div>
  );
}
