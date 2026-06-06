import { ArrowRight, CheckSquare, Filter, Workflow, Zap } from "lucide-react";
import { ResourceListView } from "@/components/paperless/resource-list-view";
import { HelpCard } from "@/components/ui/help-card";
import { SectionCard } from "@/components/ui/section-card";
import { RulesManager } from "@/components/workflows/rules-manager";
import { safePaperlessCollection } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const result = await safePaperlessCollection("/api/workflows/");

  const flow = (
    <SectionCard
      icon={Workflow}
      title="Comment fonctionne un workflow ?"
      description="Trois étapes pour automatiser le traitement de vos documents."
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
        <div className="rounded-2xl border border-blue-200/60 bg-blue-50/60 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
              <Zap className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Déclencheur
            </p>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">Un document arrive</p>
          <p className="mt-0.5 text-xs text-slate-500">consommation, import, modification…</p>
        </div>
        <ArrowRight
          aria-hidden="true"
          className="hidden h-5 w-5 text-slate-300 sm:block"
          strokeWidth={1.75}
        />
        <div className="rounded-2xl border border-violet-200/60 bg-violet-50/60 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
              <Filter className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
              Conditions
            </p>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">Si le document correspond</p>
          <p className="mt-0.5 text-xs text-slate-500">contenu, nom de fichier, source…</p>
        </div>
        <ArrowRight
          aria-hidden="true"
          className="hidden h-5 w-5 text-slate-300 sm:block"
          strokeWidth={1.75}
        />
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
              <CheckSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Actions</p>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">Alors faire ceci</p>
          <p className="mt-0.5 text-xs text-slate-500">
            assigner tags, type, correspondant, notification…
          </p>
        </div>
      </div>
    </SectionCard>
  );

  return (
    <ResourceListView
      backLink={{ href: "/documents", label: "Documents" }}
      eyebrow="Automatisation"
      title="Workflows"
      description="Les workflows classent automatiquement vos documents à leur arrivée selon des règles que vous définissez."
      result={result}
      originalPath="/workflows"
      detailBasePath="/workflows"
      help={
        <div className="space-y-4">
          <SectionCard
            icon={Zap}
            title="Règles automatiques"
            description="Appliquées à chaque document importé. Testez ou appliquez à l'existant à tout moment."
          >
            <RulesManager />
          </SectionCard>
          <HelpCard
            tone="emerald"
            icon={Workflow}
            title="Un workflow répond à : que faire automatiquement avec ce document ?"
            description="Idéal pour appliquer un tag à toutes les factures EDF, alerter quand un courrier important arrive, ou archiver automatiquement les relevés bancaires."
            examples={[
              "Si l'expéditeur contient « EDF » → tag « Maison » + type « Facture »",
              "Si le contenu OCR contient « urgent » → tag « À traiter »",
              "Toute pièce jointe Gmail → import + type « Email »",
            ]}
          />
          {flow}
        </div>
      }
      fields={[
        { key: "enabled", label: "Actif" },
        { key: "order", label: "Ordre" },
        { key: "triggers", label: "Déclencheurs" },
      ]}
    />
  );
}
