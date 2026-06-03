import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { SavedSignaturesManager } from "@/components/documents/saved-signatures-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Signatures & paraphes — Documents" };

export default function DocumentSignaturesPage() {
  return (
    <SpaceLayout spaceId="documents">
      <div className="space-y-4">
        <div>
          <h1 className="text-[18px] font-extrabold" style={{ color: "var(--text-main)" }}>Signatures &amp; paraphes</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
            Enregistrez vos signatures et paraphes pour les réutiliser lors de la signature de vos PDF.
          </p>
        </div>
        <SavedSignaturesManager />
      </div>
    </SpaceLayout>
  );
}
