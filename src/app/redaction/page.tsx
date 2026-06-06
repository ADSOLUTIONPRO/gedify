import Link from "next/link";
import {
  CheckCircle2,
  FileSignature,
  FileText,
  LayoutTemplate,
  Pencil,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { SpaceLayout } from "@/components/layout/space-layout";
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
    <SpaceLayout
      spaceId="office"
      actions={
        <Link
          href="/redaction/nouveau"
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: "var(--blue-600)" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Nouveau courrier
        </Link>
      }
    >
      <div className="space-y-5">
        {/* Bandeau d'alerte uniquement si ONLYOFFICE n'est pas configuré */}
        {!configured ? (
          <div className="flex items-start gap-3 rounded-xl border p-3.5" style={{ borderColor: "var(--gedify-orange)", background: "var(--gedify-orange-soft)" }}>
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-[13px] leading-snug" style={{ color: "var(--text-main)" }}>
              <strong>ONLYOFFICE Docs à connecter.</strong> Définissez{" "}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs text-amber-900">ONLYOFFICE_DOCUMENT_SERVER_URL</code>{" "}
              (et <code className="font-mono text-xs">ONLYOFFICE_JWT_SECRET</code>) côté serveur pour activer l&apos;édition en ligne.
            </p>
          </div>
        ) : null}

        {/* Statistiques */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Documents" value={documents.length} helper={`${drafts.length} brouillon(s)`} icon={FileText} tone="blue" />
          <StatCard label="Envoyés à la GED" value={sent.length} icon={CheckCircle2} tone="emerald" />
          <StatCard label="Signatures" value={signatures.length} helper={signatures.find((s) => s.isDefault)?.name ?? "Aucune par défaut"} icon={FileSignature} tone="violet" />
          <StatCard label="ONLYOFFICE" value={configured ? "Connecté" : "À connecter"} helper={onlyOfficeUrl ?? "Variable serveur requise"} icon={Sparkles} tone={configured ? "emerald" : "amber"} />
        </section>

        {/* Actions principales — boutons simples */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/redaction/nouveau"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "var(--blue-600)" }}
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Nouveau courrier
          </Link>
          <Link
            href="/redaction/modeles"
            className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <LayoutTemplate className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> Modèles DOCX
          </Link>
          <Link
            href="/redaction/signatures"
            className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <FileSignature className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> Signatures
          </Link>
        </div>

        {/* Documents en cours — lignes compactes */}
        <SectionCard
          icon={FileText}
          title="Documents en cours"
          description="Brouillons et courriers en attente d'envoi vers la GED."
          bodyClassName=""
        >
          {documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucun courrier pour le moment"
              description="Commencez par créer votre premier document depuis un modèle."
              action={
                <Link href="/redaction/nouveau" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90" style={{ background: "var(--blue-600)" }}>
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Créer mon premier courrier
                </Link>
              }
            />
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
              {documents.map((document) => (
                <li key={document.id} className="flex items-center gap-3 px-4 py-2 transition odd:bg-[var(--bg-card-soft)] hover:bg-slate-50/70">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.85} />
                  </span>
                  <Link href={`/redaction/${document.id}`} className="min-w-0 flex-1 truncate text-[13.5px] font-bold hover:opacity-70" style={{ color: "var(--gedify-navy)" }} title={document.title}>
                    {document.title}
                  </Link>
                  <span className="hidden shrink-0 text-[11.5px] sm:inline" style={{ color: "var(--text-muted)" }}>
                    {document.letterType} · v{document.version}
                  </span>
                  <StatusBadge status={document.status} />
                  <Link
                    href={`/redaction/${document.id}/modifier`}
                    title="Ouvrir"
                    aria-label="Ouvrir"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-xs font-semibold transition hover:bg-slate-50"
                    style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Ouvrir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </SpaceLayout>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  review: "Relecture",
  "ready-to-send": "Prêt",
  "sent-to-paperless": "Envoyé",
  archived: "Archivé",
};

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
    <span className={`hidden shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline-flex ${tone}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
