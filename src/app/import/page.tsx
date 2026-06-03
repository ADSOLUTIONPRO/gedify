import { ImportUploader } from "@/components/forms/import-uploader";
import { Button } from "@/components/ui/button";
import { CollapsibleDetails } from "@/components/ui/collapsible-details";
import { CompactCard } from "@/components/ui/compact-card";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { PageShell } from "@/components/ui/page-shell";
import { getPaperlessPublicUrl } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  const paperlessUrl = getPaperlessPublicUrl();

  return (
    <PageShell>
      <CompactPageHeader
        eyebrow="Entrée documentaire"
        title="Import"
        description="Commencez avec 10 à 20 documents pour vérifier les réglages."
        actions={
          paperlessUrl ? (
            <Button href={`${paperlessUrl}/documents`} external variant="secondary" size="md">
              Gedify original
            </Button>
          ) : null
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ImportUploader />

        <aside className="space-y-4">
          <CompactCard title="Parcours conseillé">
            <ol className="space-y-2 text-sm text-slate-600">
              <li>1. Importer un petit lot.</li>
              <li>2. Attendre OCR et indexation Gedify.</li>
              <li>3. Analyser et contrôler les résultats.</li>
              <li>4. Corriger les règles avant un import massif.</li>
            </ol>
          </CompactCard>

          <CollapsibleDetails title="Voir fonctionnement technique">
            <p>Les fichiers passent par une route interne Next.js. Gedify reste le moteur de stockage, OCR et indexation.</p>
          </CollapsibleDetails>
        </aside>
      </div>
    </PageShell>
  );
}
