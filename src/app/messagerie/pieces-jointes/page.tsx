import type { Metadata } from "next";
import { Paperclip } from "lucide-react";
import { SpaceLayout } from "@/components/layout/space-layout";
import { NoGmailState } from "@/components/messaging/no-gmail-state";
import { AttachmentsList } from "@/components/messaging/attachments-list";
import { loadAttachments } from "@/lib/messaging/load-attachments";
import { loadCorrespondentFilters } from "@/lib/messaging/correspondent-filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pièces jointes — Messagerie" };

export default async function MessageriePiecesJointesPage() {
  const [inbox, sent, correspondents] = await Promise.all([
    loadAttachments("inbox", 25),
    loadAttachments("sent", 25),
    loadCorrespondentFilters(),
  ]);

  if (!inbox.connected) {
    return (
      <SpaceLayout spaceId="messagerie">
        <NoGmailState oauthConfigured={inbox.oauthConfigured} needsReconnect={inbox.needsReconnect} />
      </SpaceLayout>
    );
  }

  return (
    <SpaceLayout spaceId="messagerie">
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--accent-soft)" }}>
          <Paperclip className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Les pièces jointes de vos mails reçus et envoyés, présentées comme la boîte de réception. Importez-les dans la GED en
            un clic — elles sont analysées par l&apos;IA puis liées au mail source.
          </p>
        </div>
        <AttachmentsList
          inbox={{ rows: inbox.rows, nextPageToken: inbox.nextPageToken }}
          sent={sent.connected ? { rows: sent.rows, nextPageToken: sent.nextPageToken } : { rows: [], nextPageToken: null }}
          correspondents={correspondents}
        />
      </div>
    </SpaceLayout>
  );
}
