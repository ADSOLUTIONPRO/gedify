import Link from "next/link";
import { ArrowRight, PenLine } from "lucide-react";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default function RedactionAIPage() {
  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/ia", label: "IA" }}
        eyebrow="Intelligence"
        title="Rédaction assistée"
        description="Génération automatique de courriers à partir des analyses IA. À connecter."
      />
      <HelpCard
        tone="blue"
        icon={PenLine}
        title="Rédaction IA — à connecter"
        description={
          <>
            Le module de rédaction ONLYOFFICE existant peut déjà être utilisé manuellement. La
            génération automatique de brouillons à partir des analyses est en préparation : on enverra
            au provider IA une requête contenant les éléments détectés et on remplira un modèle DOCX.
          </>
        }
      />
      <div className="mt-6">
        <Link
          href="/redaction"
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600"
        >
          Ouvrir la rédaction
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
