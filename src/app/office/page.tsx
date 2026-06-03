import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { SpacePlaceholder } from "@/components/spaces/space-placeholder";

export const metadata: Metadata = {
  title: "Office — Gedify",
};

export default function OfficePage() {
  return (
    <SpaceLayout spaceId="office">
      <SpacePlaceholder
        spaceId="office"
        related={[
          {
            label: "Rédaction",
            href: "/redaction",
            description: "Rédigez et mettez en forme des documents.",
          },
          {
            label: "Modèles",
            href: "/redaction/modeles",
            description: "Modèles de courriers et de documents réutilisables.",
          },
          {
            label: "Signatures",
            href: "/redaction/signatures",
            description: "Gérez vos signatures et blocs d'en-tête.",
          },
        ]}
      />
    </SpaceLayout>
  );
}
