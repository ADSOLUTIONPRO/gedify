import Link from "next/link";
import { AlertTriangle, CalendarClock, FileText, Inbox, MailOpen, Paperclip, type LucideIcon } from "lucide-react";
import { EmailList } from "@/components/messaging/email-list";
import { GmailConnectionStatus } from "@/components/messaging/gmail-connection-status";
import type { EmailGedLink } from "@/lib/messaging/email-types";
import type { LinksByThread, NormalizedThread } from "@/lib/messaging/load-threads";

type MessagingOverviewProps = {
  email: string;
  connectedAt: string;
  threads: NormalizedThread[];
  linksByThread: LinksByThread;
};

type CardDef = { label: string; value: number; color: string; icon: LucideIcon; href: string };

/** Vue d'ensemble Messagerie : statut, cartes synthèse, sections principales. */
export function MessagingOverview({ email, connectedAt, threads, linksByThread }: MessagingOverviewProps) {
  const unread = threads.filter((t) => t.unread);
  const withAttachments = threads.filter((t) => t.hasAttachments);
  const linkedThreads = threads.filter((t) => (linksByThread.get(t.id) ?? []).length > 0);

  const allLinks: EmailGedLink[] = [...linksByThread.values()].flat();
  const importedDocs = allLinks.filter((l) => l.target.kind === "document").length;
  const calendarLinks = allLinks.filter((l) => l.target.kind === "calendar").length;

  const cards: CardDef[] = [
    { label: "Non lus", value: unread.length, color: "#DB2777", icon: MailOpen, href: "/messagerie/inbox" },
    { label: "Pièces jointes à traiter", value: withAttachments.length, color: "#F97316", icon: Inbox, href: "/messagerie/pieces-jointes" },
    { label: "Pièces jointes", value: withAttachments.length, color: "#0B5CFF", icon: Paperclip, href: "/messagerie/pieces-jointes" },
    { label: "Documents importés", value: importedDocs, color: "#16A34A", icon: FileText, href: "/messagerie/pieces-jointes" },
    { label: "Rendez-vous détectés", value: calendarLinks, color: "#06B6D4", icon: CalendarClock, href: "/calendrier" },
    { label: "Erreurs", value: 0, color: "#EF4444", icon: AlertTriangle, href: "/messagerie/parametres" },
  ];

  return (
    <div className="space-y-5">
      <GmailConnectionStatus email={email} connectedAt={connectedAt} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} href={c.href} className="flex flex-col rounded-xl border bg-white p-3 transition hover:-translate-y-0.5" style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}>
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${c.color}14`, color: c.color }}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="mt-2 text-[17px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>{c.value}</span>
              <span className="text-[11px] font-medium leading-tight" style={{ color: "var(--text-muted)" }}>{c.label}</span>
            </Link>
          );
        })}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Emails à traiter</p>
          <Link href="/messagerie/inbox" className="text-[12px] font-semibold" style={{ color: "#DB2777" }}>Tout voir</Link>
        </div>
        <EmailList threads={unread.slice(0, 6)} linksByThread={linksByThread} emptyTitle="Rien à traiter" emptyDescription="Aucun email non lu pour le moment." />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Pièces jointes détectées</p>
          <Link href="/messagerie/pieces-jointes" className="text-[12px] font-semibold" style={{ color: "#0B5CFF" }}>Tout voir</Link>
        </div>
        <EmailList threads={withAttachments.slice(0, 4)} linksByThread={linksByThread} emptyTitle="Aucune pièce jointe" emptyDescription="Aucun email avec pièce jointe dans la boîte." />
      </div>

      {linkedThreads.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Conversations liées à un dossier</p>
            <Link href="/messagerie/dossiers" className="text-[12px] font-semibold" style={{ color: "#16A34A" }}>Tout voir</Link>
          </div>
          <EmailList threads={linkedThreads.slice(0, 4)} linksByThread={linksByThread} />
        </div>
      ) : null}
    </div>
  );
}
