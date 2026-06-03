import Link from "next/link";
import { ArrowRight, LayoutTemplate } from "lucide-react";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { TEMPLATES } from "@/lib/writer/templates";

export const dynamic = "force-dynamic";

export default function TemplatesPage() {
  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/redaction", label: "Rédaction" }}
        eyebrow="Bibliothèque"
        title="Modèles de courrier"
        description="Modèles prêts à l'emploi pour démarrer rapidement un courrier administratif, employeur ou juridique."
      />

      <div className="mb-6">
        <HelpCard
          tone="violet"
          icon={LayoutTemplate}
          title="Chaque modèle remplit automatiquement la structure de base"
          description="Date, destinataire, objet, formules de politesse… Vous gardez la main pour le contenu personnalisé via ONLYOFFICE."
          examples={[
            "Variables disponibles : {{ date }}, {{ ville }}, {{ destinataire }}, {{ objet }}, {{ reference }}, {{ signature }}",
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((template) => (
          <SectionCard
            key={template.id}
            icon={LayoutTemplate}
            title={template.name}
            description={template.description}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Type
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{template.letterType}</p>
            {template.variables.length > 0 ? (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Variables
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {template.variables.map((variable) => (
                    <span
                      key={variable}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600"
                    >
                      {`{{ ${variable} }}`}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            <Link
              href={`/redaction/nouveau?template=${template.id}`}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"
            >
              Utiliser ce modèle
              <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </Link>
          </SectionCard>
        ))}
      </div>
    </main>
  );
}
