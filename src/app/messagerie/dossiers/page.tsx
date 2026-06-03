import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FolderTree } from "lucide-react";
import { SpaceLayout } from "@/components/layout/space-layout";
import { NoGmailState } from "@/components/messaging/no-gmail-state";
import { EmailList } from "@/components/messaging/email-list";
import { loadLinkedThreads } from "@/lib/messaging/load-threads";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Liés à la GED — Messagerie" };

export default async function MessagerieDossiersPage() {
  const result = await loadLinkedThreads(120);
  if (!result.connected) {
    return (
      <SpaceLayout spaceId="messagerie">
        <NoGmailState oauthConfigured={result.oauthConfigured} />
      </SpaceLayout>
    );
  }

  return (
    <SpaceLayout spaceId="messagerie">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Conversations reliées à la GED : document, dossier/projet ou correspondant.
          </p>
          <Link href="/organiser/dossiers" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
            <FolderTree className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Dossiers
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
        <EmailList
          threads={result.threads}
          linksByThread={result.linksByThread}
          emptyTitle="Aucune conversation liée"
          emptyDescription="Liez une conversation à un document, un dossier ou un correspondant depuis la vue d'un email (bouton « Classer »)."
        />
      </div>
    </SpaceLayout>
  );
}
