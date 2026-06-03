import { ExternalLink, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getPaperlessPublicUrl } from "@/lib/paperless";
import { CorbeillecClient } from "@/components/corbeille/corbeille-client";

export const dynamic = "force-dynamic";

export default function CorbeillePage() {
  const paperlessUrl = getPaperlessPublicUrl();

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { label: "Corbeille" },
        ]}
        title="Corbeille"
        description="Documents supprimés dans la GED. Restaurez-les ou supprimez-les définitivement."
        actions={
          paperlessUrl ? (
            <a
              href={`${paperlessUrl}/trash`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Ouvrir le document
            </a>
          ) : null
        }
      />

      <SectionCard
        icon={Trash2}
        title="Documents supprimés"
        description="Sélectionnez un ou plusieurs documents pour les restaurer ou les supprimer définitivement."
      >
        <CorbeillecClient />
      </SectionCard>
    </PageShell>
  );
}
