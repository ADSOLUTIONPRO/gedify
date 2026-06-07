"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, GitMerge, Plus, Users } from "lucide-react";
import { CorrespondentsList } from "./correspondents-list";
import { CorrespondentDetailPanel } from "./correspondent-detail-panel";

/**
 * Vue-modèle d'un correspondant pour l'espace de travail.
 * `id`, `name`, `documentCount` viennent du moteur (réels). Les autres champs
 * sont optionnels : ils seront branchés sur les vraies données (contacts/sync)
 * sans changer l'UI — pour l'instant rendus avec des états vides propres.
 */
export type CorrespondentVM = {
  id: number;
  name: string;
  documentCount: number;
  organization?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: "synced" | "manual" | null;
  tags?: string[];
  address?: string | null;
  notes?: string | null;
  isDuplicate?: boolean;
};

type Props = {
  correspondents: CorrespondentVM[];
  duplicateIds: number[];
  error?: string | null;
};

export function CorrespondentsWorkspace({ correspondents, duplicateIds, error }: Props) {
  const dupSet = useMemo(() => new Set(duplicateIds), [duplicateIds]);
  const items = useMemo(
    () => correspondents.map((c) => ({ ...c, isDuplicate: dupSet.has(c.id) })),
    [correspondents, dupSet],
  );

  const [selectedId, setSelectedId] = useState<number | null>(items[0]?.id ?? null);
  const selected =
    items.find((c) => c.id === selectedId) ?? items[0] ?? null;

  const kpi = useMemo(() => {
    const total = items.length;
    const documentsLinked = items.reduce((s, c) => s + c.documentCount, 0);
    const withDocuments = items.filter((c) => c.documentCount > 0).length;
    return { total, documentsLinked, withDocuments, toMerge: duplicateIds.length };
  }, [items, duplicateIds.length]);

  return (
    <div className="p-4 lg:p-6">
      {/* En-tête + action */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold" style={{ color: "var(--text-main)" }}>Correspondants</h1>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Organismes et personnes liés à vos documents.
          </p>
        </div>
        <Link
          href="/correspondants?nouveau=1"
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          Nouveau correspondant
        </Link>
      </div>

      {/* KPI */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} tone="var(--accent)" value={kpi.total} label="Correspondants" hint="Total" />
        <Kpi icon={FileText} tone="var(--gedify-info)" value={kpi.documentsLinked} label="Documents liés" hint="Tous correspondants" />
        <Kpi icon={CheckCircle2} tone="var(--gedify-green)" value={kpi.withDocuments} label="Avec documents" hint={kpi.total ? `${Math.round((kpi.withDocuments / kpi.total) * 100)}% du total` : "—"} />
        <Kpi
          icon={GitMerge}
          tone="var(--gedify-orange)"
          value={kpi.toMerge}
          label="À fusionner"
          hint={kpi.toMerge > 0 ? "Doublons détectés" : "Aucun doublon"}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border p-4 text-[13px]" style={{ borderColor: "var(--gedify-orange)", background: "var(--gedify-orange-soft)", color: "var(--text-main)" }}>
          Chargement des correspondants impossible : {error}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(340px,420px)_1fr]">
          <CorrespondentsList
            items={items}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            toMergeCount={kpi.toMerge}
          />
          <CorrespondentDetailPanel correspondent={selected} />
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  tone,
  value,
  label,
  hint,
}: {
  icon: React.ElementType;
  tone: string;
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${tone} 14%, white)`, color: tone }}>
        <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: "var(--text-main)" }}>
          {value.toLocaleString("fr-FR")}
        </p>
        <p className="mt-1 truncate text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{label}</p>
        <p className="truncate text-[11px]" style={{ color: "var(--text-hint)" }}>{hint}</p>
      </div>
    </div>
  );
}
