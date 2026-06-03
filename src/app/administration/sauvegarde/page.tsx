import { Database, Download, Upload, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { ExportButton } from "@/components/admin/export-button";
import { ImportPanel } from "@/components/admin/import-panel";

export const dynamic = "force-dynamic";

export default function SauvegardePage() {
  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/administration", label: "Administration" },
          { label: "Sauvegarde & migration" },
        ]}
        title="Sauvegarde & migration"
        description="Importez une archive .zip Gedify (depuis l'ancienne surcouche ou nopp), ou exportez vos données."
      />

      <SectionCard
        icon={Upload}
        title="Importer une archive"
        description="Restaure documents, taxonomies et données internes en préservant les identifiants."
      >
        <ImportPanel />
      </SectionCard>

      <SectionCard
        icon={Download}
        title="Exporter toutes les données"
        description="Documents, fichiers, taxonomies, analyses IA, dossiers, finances, courriers et réglages."
      >
        <ExportButton />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={Database}
          title="Ce que contient l'archive"
          description="Un instantané complet et autoportant."
        >
          <ul className="space-y-1.5 text-[13px]" style={{ color: "var(--text-main)" }}>
            <li>• Documents (métadonnées + fichiers originaux)</li>
            <li>• Taxonomies : tags, correspondants, types, chemins, champs perso, vues</li>
            <li>• Analyses OCR &amp; fiches IA</li>
            <li>• Dossiers &amp; projets « Organiser »</li>
            <li>• Finances, actions &amp; rappels</li>
            <li>• Courriers, signatures, liens mail↔document</li>
            <li>• Documents « Writer »</li>
          </ul>
        </SectionCard>

        <SectionCard
          icon={ShieldCheck}
          title="Sécurité & migration"
          description="Bonnes pratiques."
        >
          <ul className="space-y-1.5 text-[13px]" style={{ color: "var(--text-main)" }}>
            <li>• Les jetons OAuth Gmail et mots de passe IMAP sont <strong>exclus</strong> de l&apos;archive.</li>
            <li>• Après import, reconnectez vos boîtes mail.</li>
            <li>• Le mode « Remplacer » efface les données existantes avant l&apos;import.</li>
            <li>• Le mode « Fusionner » ajoute / met à jour sans tout effacer.</li>
            <li>• Les identifiants des documents sont préservés : aucun lien interne n&apos;est cassé.</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
