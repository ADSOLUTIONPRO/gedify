import "server-only";

import type { MailEncryption } from "@/lib/mail-connector/types";

/* Auto-détection des réglages IMAP à partir de l'adresse email (clôture mail) :
   1) table intégrée des fournisseurs courants (réponse instantanée et fiable) ;
   2) base Mozilla ISPDB (autoconfig.thunderbird.net) — couvre des milliers de
      domaines ; best-effort avec timeout ;
   3) repli heuristique imap.<domaine>:993 SSL.
   Objectif : « ça marche du premier coup » pour la majorité des boîtes. */

export type ImapAutodetect = {
  imapHost: string;
  imapPort: number;
  encryption: MailEncryption;
  source: "builtin" | "ispdb" | "guess";
  providerId?: string;
};

type Preset = { host: string; port: number; enc: MailEncryption; providerId?: string };

const GMAIL: Preset = { host: "imap.gmail.com", port: 993, enc: "tls", providerId: "gmail" };
const OUTLOOK: Preset = { host: "outlook.office365.com", port: 993, enc: "tls", providerId: "outlook" };
const YAHOO: Preset = { host: "imap.mail.yahoo.com", port: 993, enc: "tls", providerId: "yahoo" };
const ICLOUD: Preset = { host: "imap.mail.me.com", port: 993, enc: "tls" };

/** Domaines → réglages IMAP connus (les plus courants, incl. FR). */
const DOMAIN_MAP: Record<string, Preset> = {
  "gmail.com": GMAIL,
  "googlemail.com": GMAIL,
  "outlook.com": OUTLOOK,
  "outlook.fr": OUTLOOK,
  "hotmail.com": OUTLOOK,
  "hotmail.fr": OUTLOOK,
  "live.com": OUTLOOK,
  "live.fr": OUTLOOK,
  "msn.com": OUTLOOK,
  "office365.com": OUTLOOK,
  "yahoo.com": YAHOO,
  "yahoo.fr": YAHOO,
  "ymail.com": YAHOO,
  "icloud.com": ICLOUD,
  "me.com": ICLOUD,
  "mac.com": ICLOUD,
  "free.fr": { host: "imap.free.fr", port: 993, enc: "tls" },
  "orange.fr": { host: "imap.orange.fr", port: 993, enc: "tls" },
  "wanadoo.fr": { host: "imap.orange.fr", port: 993, enc: "tls" },
  "sfr.fr": { host: "imap.sfr.fr", port: 993, enc: "tls" },
  "neuf.fr": { host: "imap.sfr.fr", port: 993, enc: "tls" },
  "laposte.net": { host: "imap.laposte.net", port: 993, enc: "tls" },
  "bbox.fr": { host: "imap.bbox.fr", port: 993, enc: "tls" },
  "gmx.com": { host: "imap.gmx.com", port: 993, enc: "tls" },
  "gmx.fr": { host: "imap.gmx.fr", port: 993, enc: "tls" },
  "gmx.net": { host: "imap.gmx.net", port: 993, enc: "tls" },
  "infomaniak.com": { host: "mail.infomaniak.com", port: 993, enc: "tls", providerId: "infomaniak" },
  "ik.me": { host: "mail.infomaniak.com", port: 993, enc: "tls", providerId: "infomaniak" },
  "protonmail.com": { host: "127.0.0.1", port: 1143, enc: "starttls" }, // nécessite Proton Bridge
  "proton.me": { host: "127.0.0.1", port: 1143, enc: "starttls" },
};

function domainOf(email: string): string | null {
  const at = email.indexOf("@");
  if (at < 0) return null;
  const d = email.slice(at + 1).trim().toLowerCase();
  return d && d.includes(".") ? d : null;
}

/** Parse un bloc ISPDB et renvoie le 1er serveur IMAP (best-effort, regex tolérant). */
function parseIspdbImap(xml: string): Preset | null {
  // Isole le bloc <incomingServer type="imap"> … </incomingServer>
  const block = xml.match(/<incomingServer\b[^>]*type=["']imap["'][^>]*>([\s\S]*?)<\/incomingServer>/i);
  if (!block) return null;
  const inner = block[1];
  const host = inner.match(/<hostname>\s*([^<]+?)\s*<\/hostname>/i)?.[1];
  const port = Number(inner.match(/<port>\s*(\d+)\s*<\/port>/i)?.[1]);
  const socket = inner.match(/<socketType>\s*([^<]+?)\s*<\/socketType>/i)?.[1]?.toUpperCase();
  if (!host || !Number.isFinite(port)) return null;
  const enc: MailEncryption = socket === "STARTTLS" ? "starttls" : socket === "PLAIN" || socket === "NONE" ? "none" : "tls";
  return { host, port, enc };
}

async function fetchIspdb(domain: string): Promise<Preset | null> {
  try {
    const res = await fetch(`https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/xml,text/xml,*/*" },
    });
    if (!res.ok) return null;
    return parseIspdbImap(await res.text());
  } catch {
    return null;
  }
}

export async function autodetectImap(email: string): Promise<ImapAutodetect | null> {
  const domain = domainOf((email ?? "").trim());
  if (!domain) return null;

  const builtin = DOMAIN_MAP[domain];
  if (builtin) {
    return { imapHost: builtin.host, imapPort: builtin.port, encryption: builtin.enc, source: "builtin", providerId: builtin.providerId };
  }

  const ispdb = await fetchIspdb(domain);
  if (ispdb) {
    return { imapHost: ispdb.host, imapPort: ispdb.port, encryption: ispdb.enc, source: "ispdb" };
  }

  // Repli : convention la plus répandue (IMAPS).
  return { imapHost: `imap.${domain}`, imapPort: 993, encryption: "tls", source: "guess" };
}
