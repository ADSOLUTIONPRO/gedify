import { FileSignature, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { SignaturePad } from "@/components/writer/signature-pad";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { listSignatures } from "@/lib/writer/signature-store";

export const dynamic = "force-dynamic";

export default async function SignaturesPage() {
  const signatures = await listSignatures();

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/redaction", label: "Rédaction" }}
        eyebrow="Rédaction"
        title="Signatures manuscrites"
        description="Importez une image PNG/JPG ou dessinez votre signature pour l'insérer dans vos courriers."
      />

      <div className="mb-6">
        <HelpCard
          tone="emerald"
          icon={ShieldCheck}
          title="Vos signatures restent sur le serveur"
          description="Les images sont stockées dans le dossier serveur SIGNATURE_STORAGE_PATH. L'insertion automatique dans ONLYOFFICE arrive prochainement — pour l'instant, utilisez « Télécharger » puis insérez l'image dans l'éditeur via Insérer → Image."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <SectionCard icon={FileSignature} title="Nouvelle signature">
          <SignaturePad />
        </SectionCard>

        <SectionCard
          icon={FileSignature}
          title={`Signatures enregistrées (${signatures.length})`}
          description="Cliquez pour télécharger l'image avant insertion dans ONLYOFFICE."
          bodyClassName=""
        >
          {signatures.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="Aucune signature pour le moment"
              description="Importez une image ou dessinez votre signature avec la souris ou le doigt."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {signatures.map((signature) => (
                <li
                  key={signature.id}
                  className="grid gap-3 p-4 sm:grid-cols-[100px_1fr_auto] sm:items-center"
                >
                  <div className="rounded-xl border border-slate-200/60 bg-white p-2">
                    <Image
                      src={`/api/writer/signatures/${signature.id}?download=1`}
                      alt={signature.name}
                      width={signature.width}
                      height={signature.height}
                      unoptimized
                      className="h-16 w-auto object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {signature.name}
                      {signature.isDefault ? (
                        <span className="ml-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Par défaut
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {signature.contentType} ·{" "}
                      {new Date(signature.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/writer/signatures/${signature.id}?download=1`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Télécharger
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
