import { LayoutTemplate } from "lucide-react";
import { NewDocumentForm } from "@/components/writer/new-document-form";
import { FormCard } from "@/components/ui/form-card";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { TEMPLATES } from "@/lib/writer/templates";

export const dynamic = "force-dynamic";

export default function NewDocumentPage() {
  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/redaction", label: "Rédaction" }}
        eyebrow="Assistant"
        title="Nouveau courrier"
        description="Choisissez un type de courrier, un modèle, et renseignez les informations principales. Le document DOCX est généré côté serveur."
      />

      <div className="mb-6">
        <HelpCard
          tone="blue"
          icon={LayoutTemplate}
          title="Comment ça marche ?"
          description="Les champs ci-dessous remplissent le fichier .docx généré : destinataire, objet, référence et date. Vous pourrez ensuite éditer librement le contenu dans ONLYOFFICE."
          examples={[
            "Choisissez un type → un modèle adapté",
            "Renseignez l'objet et la référence",
            "Cliquez sur « Créer » pour ouvrir l'éditeur",
          ]}
        />
      </div>

      <FormCard
        icon={LayoutTemplate}
        title="Informations du courrier"
        description={`${TEMPLATES.length} modèles disponibles. Vous pourrez ajuster ces informations à tout moment.`}
      >
        <NewDocumentForm templates={TEMPLATES} />
      </FormCard>
    </main>
  );
}
