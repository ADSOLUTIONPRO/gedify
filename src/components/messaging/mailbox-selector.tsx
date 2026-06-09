"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Inbox } from "lucide-react";

/* Filtre « Boîte mail » de l'espace Mails : choisit la boîte consultée quand
   plusieurs sont connectées (Google + IMAP, sans priorité).

   - Source de vérité : paramètre d'URL `?accountId=` (rechargeable, partageable,
     conservé au retour navigateur). Repli cookie pour la persistance inter-vues.
   - Valeurs : "all" (défaut) + chaque compte réellement connecté (jamais de
     liste statique). Tri par affichage A–Z.
   Lu côté serveur par getInboxGmailAccounts (URL prioritaire sur cookie). */

type Acct = { id: string; email: string; name?: string; type: "gmail" | "imap"; canSend: boolean };

const COOKIE = "gedify_active_mailbox";

function readCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function providerLabel(type: Acct["type"]): string {
  return type === "gmail" ? "Google" : "IMAP";
}

export function MailboxSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Acct[]>([]);

  // URL prioritaire ; sinon cookie ; sinon « toutes les boîtes ».
  const urlAccount = searchParams.get("accountId");
  const [active, setActive] = useState<string>(urlAccount || "all");

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
      if (!cancelled && !urlAccount) setActive(readCookie(COOKIE) || "all");
    })();
    return () => {
      cancelled = true;
    };
  }, [urlAccount]);

  // Tri par nom d'affichage / email A–Z (comptes réels uniquement).
  const sorted = useMemo(
    () => [...accounts].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "fr", { sensitivity: "base" })),
    [accounts],
  );

  // Un seul compte (ou aucun) → pas de filtre.
  if (accounts.length <= 1) return null;

  function choose(id: string) {
    setActive(id);
    // Persistance inter-vues (cookie) + source de vérité partageable (URL).
    document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
    const params = new URLSearchParams(searchParams.toString());
    if (id === "all") params.delete("accountId");
    else params.set("accountId", id);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
      <Inbox className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden sm:inline">Boîte mail :</span>
      <select
        value={active}
        onChange={(e) => choose(e.target.value)}
        className="max-w-[230px] truncate rounded-lg border bg-white px-2 py-1 text-[12.5px] font-semibold outline-none"
        style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
      >
        <option value="all">Toutes les boîtes</option>
        {sorted.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name ? `${a.name} — ${a.email}` : a.email} ({providerLabel(a.type)})
          </option>
        ))}
      </select>
    </label>
  );
}
