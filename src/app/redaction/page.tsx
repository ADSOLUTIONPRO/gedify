import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileSignature,
  FileText,
  LayoutTemplate,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { FeatureGrid } from "@/components/paperless/feature-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import {
  isOnlyOfficeConfigured,
  getOnlyOfficeServerUrl,
} from "@/lib/writer/onlyoffice-config";
import { listSignatures } from "@/lib/writer/signature-store";
import { listWriterDocuments } from "@/lib/writer/writer-store";

export const dynamic = "force-dynamic";

export default async function RedactionHubPage() {
  const [documents, signatures] = await Promise.all([
    listWriterDocuments(),
    listSignatures(),
  ]);
  const configured = isOnlyOfficeConfigured();
  const onlyOfficeUrl = getOnlyOfficeServerUrl();
  const drafts = documents.filter((doc) => doc.status === "draft" || doc.status === "review");
  const sent = documents.filter((doc) => doc.status === "sent-to-paperless");

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        eyebrow="Rédaction"
        title="Traitement de texte ONLYOFFICE"
        description="Rédigez vos courriers, modifiez des fichiers DOCX, insérez votre signature et envoyez le document final vers la GED."
        actions={
          <Link
            href="/redaction/nouveau"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Nouveau courrier
          </Link>
        }
      />

      <div className="mb-6">
        <HelpCard
          tone={configured ? "blue" : "amber"}
          icon={configured ? Sparkles : Pencil}
          title={
            configured
              ? "ONLYOFFICE Docs est configuré."
              : "ONLYOFFICE Docs à connecter."
          }
          description={
            configured ? (
              <>
                Serveur configuré sur{" "}
                <code className="rounded bg-white/60 px-1 font-mono text-xs">{onlyOfficeUrl}</code>.
                Créez un courrier puis ouvrez l&apos;éditeur en ligne — la sauvegarde est automatique
                via callback signé JWT (si <code className="font-mono">ONLYOFFICE_JWT_SECRET</code> est défini).
              </>
            ) : (
              <>
                Définissez{" "}
                <code className="rounded bg-white/60 px-1 font-mono text-xs">ONLYOFFICE_DOCUMENT_SERVER_URL</code>{" "}
                et idéalement <code className="font-mono">ONLYOFFICE_JWT_SECRET</code> pour activer
                l&apos;édition en ligne. Voir <code className="font-mono">docs/ONLYOFFICE_SETUP.md</code>.
              </>
            )
          }
        />
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Documents"
          value={documents.length}
          helper={`${drafts.length} brouillon(s)`}
          icon={FileText}
          tone="blue"
        />
        <StatCard
          label="Envoyés à Gedify"
          value={sent.length}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Signatures"
          value={signatures.length}
          helper={signatures.find((s) => s.isDefault)?.name ?? "Aucune par défaut"}
          icon={FileSignature}
          tone="violet"
        />
        <StatCard
          label="ONLYOFFICE"
          value={configured ? "Connecté" : "À connecter"}
          helper={onlyOfficeUrl ?? "Variable d'environnement requise"}
          icon={Sparkles}
          tone={configured ? "emerald" : "amber"}
        />
      </section>

      <div className="mb-6">
        <FeatureGrid
          links={[
            {
              title: "Nouveau courrier",
              description: "Assistant pas-à-pas pour créer un courrier à partir d'un modèle.",
              href: "/redaction/nouveau",
              icon: Plus,
              tone: "blue",
            },
            {
              title: "Modèles DOCX",
              description: "Bibliothèque de modèles : courriers administratifs, employeur, CAF, CPAM…",
              href: "/redaction/modeles",
              icon: LayoutTemplate,
              tone: "violet",
            },
            {
              title: "Signatures",
              description: "Importez ou dessinez votre signature manuscrite.",
              href: "/redaction/signatures",
              icon: FileSignature,
              tone: "emerald",
            },
          ]}
        />
      </div>

      <SectionCard
        icon={FileText}
        title="Documents en cours"
        description="Brouillons et courriers en attente d'envoi vers la GED."
        actions={
          documents.length > 0 ? (
            <Link
              href="/redaction/nouveau"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
            >
              Nouveau
              <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </Link>
          ) : null
        }
        bodyClassName=""
      >
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucun courrier pour le moment"
            description="Commencez par créer votre premier document depuis un modèle."
            action={
              <Link
                href="/redaction/nouveau"
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600"
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Créer mon premier courrier
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((document) => (
              <li
                key={document.id}
                className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <Link
                    href={`/redaction/${document.id}`}
                    className="truncate text-sm font-bold text-slate-900 hover:text-blue-700"
                  >
                    {document.title}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {document.letterType} · v{document.version} ·{" "}
                    {new Date(document.updatedAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={document.status} />
                  <Link
                    href={`/redaction/${document.id}/modifier`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Ouvrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "border-slate-200 bg-slate-50 text-slate-600",
    review: "border-amber-200 bg-amber-50 text-amber-700",
    "ready-to-send": "border-blue-200 bg-blue-50 text-blue-700",
    "sent-to-paperless": "border-emerald-200 bg-emerald-50 text-emerald-700",
    archived: "border-slate-200 bg-slate-100 text-slate-600",
  };
  const tone = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}
