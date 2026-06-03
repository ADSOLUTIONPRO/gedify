import type { ReactNode } from "react";
import { MessagerieShell } from "@/components/messaging/messagerie-shell";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";

export default async function MessagerieLayout({ children }: { children: ReactNode }) {
  const account = await getActiveGmailAccount().catch(() => null);
  return (
    <MessagerieShell email={account?.email ?? null}>
      {children}
    </MessagerieShell>
  );
}
