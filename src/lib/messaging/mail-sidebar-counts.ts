import "server-only";

import { indexLinksByThread } from "@/lib/messaging/email-ged-link-store";
import { indexLinksByThread as indexAttachmentImportsByThread } from "@/lib/messaging/mail-document-links-store";
import { getHiddenSenderEmails } from "@/lib/messaging/hidden-senders-store";
import type { MailSidebarCounts } from "@/components/messaging/messagerie-shell";

/**
 * Compteurs de la sidebar Messagerie — calculés depuis les stores GED locaux
 * (aucun appel fournisseur, donc rapide et compatible SQLite/Postgres/JSON).
 *   - processed  : conversations « Importés en GED » (liées GED OU PJ importée) ;
 *   - attachments: pièces jointes réellement importées en GED ;
 *   - hidden     : expéditeurs masqués.
 * `toProcess` (nombre exact à traiter) nécessiterait un comptage fournisseur →
 * laissé à null (pas de chiffre trompeur).
 */
export async function getMailSidebarCounts(): Promise<MailSidebarCounts> {
  try {
    const [links, attImports, hidden] = await Promise.all([
      indexLinksByThread(),
      indexAttachmentImportsByThread(),
      getHiddenSenderEmails(),
    ]);

    const processed = new Set<string>(links.keys());
    let importedAttachments = 0;
    for (const [tid, list] of attImports) {
      const imported = list.filter((l) => l.status === "imported");
      if (imported.length > 0) processed.add(tid);
      importedAttachments += imported.length;
    }

    return { processed: processed.size, attachments: importedAttachments, hidden: hidden.size, toProcess: null };
  } catch {
    return { processed: 0, attachments: 0, hidden: 0, toProcess: null };
  }
}
