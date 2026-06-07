import type { ReactNode } from "react";
import { MessagerieShell } from "@/components/messaging/messagerie-shell";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { getMailSidebarCounts } from "@/lib/messaging/mail-sidebar-counts";

export default async function MessagerieLayout({ children }: { children: ReactNode }) {
  const [account, counts] = await Promise.all([
    getActiveGmailAccount().catch(() => null),
    getMailSidebarCounts(),
  ]);
  return (
    <MessagerieShell email={account?.email ?? null} counts={counts}>
      {children}
    </MessagerieShell>
  );
}
