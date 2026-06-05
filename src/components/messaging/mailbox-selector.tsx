"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";

/* Sélecteur « Boîte active » : choisit la boîte mail consultée quand plusieurs
   sont connectées (Google + IMAP, sans priorité). Pose un cookie lu côté serveur
   (active-gmail-account) qui filtre l'inbox. Masqué s'il n'y a qu'une boîte. */

type Acct = { id: string; email: string; type: "gmail" | "imap"; canSend: boolean };

const COOKIE = "gedify_active_mailbox";

function readCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export function MailboxSelector() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [active, setActive] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/messaging/accounts", { credentials: "include", cache: "no-store" });
        const d = res.ok ? await res.json() : null;
        if (!cancelled && d?.accounts) setAccounts(d.accounts as Acct[]);
      } catch {
        /* ignore */
      }
      if (!cancelled) setActive(readCookie(COOKIE) || "all");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Un seul compte (ou aucun) → pas de sélecteur.
  if (accounts.length <= 1) return null;

  function choose(id: string) {
    setActive(id);
    document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
      <Inbox className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden sm:inline">Boîte active :</span>
      <select
        value={active}
        onChange={(e) => choose(e.target.value)}
        className="max-w-[200px] truncate rounded-lg border bg-white px-2 py-1 text-[12.5px] font-semibold outline-none"
        style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
      >
        <option value="all">Toutes les boîtes</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.email}
          </option>
        ))}
      </select>
    </label>
  );
}
