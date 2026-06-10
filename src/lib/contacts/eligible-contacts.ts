import "server-only";

import { listMailDocumentLinks } from "@/lib/messaging/mail-document-links-store";
import { getHiddenSenderEmails } from "@/lib/messaging/hidden-senders-store";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { getGmailMessage } from "@/lib/connectors/gmail/gmail-api";
import { normaliseGmailMessage } from "@/lib/messaging/gmail-normalize";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";
import { getDocument } from "@/lib/paperless";

/* ────────────────────────────────────────────────────────────────────────
   Contacts ÉLIGIBLES (règle métier GEDify).

   Un contact n'apparaît QUE s'il est lié à au moins un email :
     • non masqué (expéditeur non muté) ;
     • possédant une pièce jointe RÉELLEMENT importée dans la GED ;
     • dont le document GED existe encore (non supprimé).

   Aucune donnée source n'est supprimée : on ne fait que filtrer la VUE.
   Logique centralisée ici (jamais dupliquée dans les pages).
   ──────────────────────────────────────────────────────────────────────── */

/** Adresses techniques exclues (no-reply, daemon…). */
const EXCLUDE_PATTERNS = [
  /^no-?reply@/i,
  /^do-?not-?reply@/i,
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^notifications?@/i,
  /^bounce/i,
];

export function normalizeEmail(e: string | null | undefined): string {
  return (e ?? "").trim().toLowerCase();
}

/** Adresse à exclure (technique / invalide). */
export function isExcludedAddress(email: string): boolean {
  if (!email || !email.includes("@") || email.length < 5) return true;
  return EXCLUDE_PATTERNS.some((re) => re.test(email));
}

export type EligibleContact = {
  id: string;
  displayName: string;
  email: string;
  /** Toutes les adresses connues (édition manuelle incluse). */
  emails: string[];
  company: string | null;
  /** Champs éditables (proviennent d'une fiche éditée manuellement, si présente). */
  phone: string | null;
  address: string | null;
  notes: string | null;
  source: "email";
  linkedEmailsCount: number;
  linkedGedDocumentsCount: number;
  linkedDocumentIds: number[];
  lastInteractionAt: string | null;
};

export type EligibleReport = {
  importedLinks: number;
  validDocs: number;
  emailsAnalyzed: number;
  contactsBuilt: number;
  excluded: number;
  hiddenSkipped: number;
  accountConnected: boolean;
};

export type EligibleContactsResult = { contacts: EligibleContact[]; report: EligibleReport };

/**
 * Une pièce jointe est « importée dans la GED » si son lien d'import a le statut
 * `imported` ET référence un document (`paperlessDocumentId`). Cf. règle métier.
 */
export function isImportedGedLinkStatus(status: string): boolean {
  return status === "imported";
}

export async function computeEligibleContacts(opts?: { limitEmails?: number }): Promise<EligibleContactsResult> {
  const account = await getActiveGmailAccount();
  const report: EligibleReport = {
    importedLinks: 0, validDocs: 0, emailsAnalyzed: 0, contactsBuilt: 0,
    excluded: 0, hiddenSkipped: 0, accountConnected: Boolean(account),
  };

  // 1) Liens de PJ réellement importées en GED.
  const imported = (await listMailDocumentLinks({ status: "imported" })).filter(
    (l) => l.paperlessDocumentId != null,
  );
  report.importedLinks = imported.length;
  if (imported.length === 0 || !account) {
    console.log(`[contacts] eligible importedLinks=${imported.length} account=${Boolean(account)} → 0 contact`);
    return { contacts: [], report };
  }

  // 2) Documents GED encore existants (non supprimés) — vérif par id (borné).
  const docIds = [...new Set(imported.map((l) => l.paperlessDocumentId).filter((n): n is number => typeof n === "number"))];
  const validDocIds = new Set<number>();
  await Promise.all(
    docIds.map(async (id) => {
      try {
        const d = await getDocument(id);
        if (d && (d as { id?: number }).id != null) validDocIds.add(id);
      } catch {
        /* 404 → document supprimé → non valide */
      }
    }),
  );
  report.validDocs = validDocIds.size;

  // docs valides regroupés par mailId.
  const docsByMail = new Map<string, Set<number>>();
  for (const l of imported) {
    if (l.paperlessDocumentId == null || !validDocIds.has(l.paperlessDocumentId)) continue;
    const set = docsByMail.get(l.mailId) ?? new Set<number>();
    set.add(l.paperlessDocumentId);
    docsByMail.set(l.mailId, set);
  }

  // 3) Masquage + enrichissement (nom, société, téléphone, adresse, notes) depuis
  //    le store contacts. Une fiche éditée manuellement PRIME (ses champs gagnent).
  const hidden = await getHiddenSenderEmails();
  type Rec = { displayName: string; organization: string | null; phone: string | null; address: string | null; notes: string | null; emails: string[]; edited: boolean };
  const recByEmail = new Map<string, Rec>();
  for (const r of await listEmailContacts()) {
    const rec: Rec = {
      displayName: r.displayName,
      organization: r.organization,
      phone: r.phone ?? null,
      address: r.address ?? null,
      notes: r.notes ?? null,
      emails: [r.email, ...(r.emails ?? [])].filter((e): e is string => Boolean(e)),
      edited: Boolean(r.manuallyEdited),
    };
    for (const e of rec.emails) {
      const n = normalizeEmail(e);
      if (!n) continue;
      const prior = recByEmail.get(n);
      // Conserve la première fiche, SAUF si une fiche éditée manuellement existe.
      if (!prior || (rec.edited && !prior.edited)) recByEmail.set(n, rec);
    }
  }

  // 4) Pour chaque email à PJ importée : participants → contacts éligibles.
  type Agg = { displayName: string; company: string | null; phone: string | null; address: string | null; notes: string | null; addresses: string[]; emails: Set<string>; docs: Set<number>; last: string | null };
  const byContact = new Map<string, Agg>();
  const mailIds = [...docsByMail.keys()].slice(0, opts?.limitEmails ?? 300);
  const selfEmail = normalizeEmail(account.email);

  for (const mailId of mailIds) {
    let msg;
    try {
      const raw = await getGmailMessage(account.accountId, mailId);
      msg = normaliseGmailMessage(raw, { accountId: account.accountId, accountEmail: account.email });
    } catch {
      continue;
    }
    report.emailsAnalyzed += 1;

    // Email masqué = expéditeur masqué → ne participe pas.
    const senderEmail = normalizeEmail(msg.from?.email);
    if (senderEmail && hidden.has(senderEmail)) { report.hiddenSkipped += 1; continue; }

    const docs = docsByMail.get(mailId)!;
    const date = msg.date ?? null;
    const participants = [msg.from, ...msg.to, ...msg.cc].filter((p): p is NonNullable<typeof p> => Boolean(p));

    for (const p of participants) {
      const email = normalizeEmail(p.email);
      if (!email || email === selfEmail) continue;
      if (isExcludedAddress(email)) { report.excluded += 1; continue; }
      if (hidden.has(email)) { report.hiddenSkipped += 1; continue; }

      const rec = recByEmail.get(email);
      // Le nom édité manuellement prime sur celui de l'en-tête email.
      const name = (rec?.edited ? rec.displayName : (p.name || rec?.displayName)) || email.split("@")[0];
      const agg = byContact.get(email) ?? {
        displayName: name,
        company: rec?.organization ?? null,
        phone: rec?.phone ?? null,
        address: rec?.address ?? null,
        notes: rec?.notes ?? null,
        addresses: rec?.emails?.length ? rec.emails.map((e) => normalizeEmail(e)).filter(Boolean) : [email],
        emails: new Set(),
        docs: new Set(),
        last: null,
      };
      if (rec?.edited) agg.displayName = rec.displayName; // garde le nom édité même si déjà agrégé
      agg.emails.add(mailId);
      for (const d of docs) agg.docs.add(d);
      if (date && (!agg.last || date > agg.last)) agg.last = date;
      if (!agg.company && rec?.organization) agg.company = rec.organization;
      byContact.set(email, agg);
    }
  }

  const contacts: EligibleContact[] = [...byContact.entries()]
    .map(([email, a]) => ({
      id: email,
      displayName: a.displayName,
      email,
      emails: Array.from(new Set(a.addresses.length ? a.addresses : [email])),
      company: a.company,
      phone: a.phone,
      address: a.address,
      notes: a.notes,
      source: "email" as const,
      linkedEmailsCount: a.emails.size,
      linkedGedDocumentsCount: a.docs.size,
      linkedDocumentIds: [...a.docs],
      lastInteractionAt: a.last,
    }))
    .sort((x, y) => x.displayName.localeCompare(y.displayName, "fr"));

  report.contactsBuilt = contacts.length;
  console.log(
    `[contacts] eligible importedLinks=${report.importedLinks} validDocs=${report.validDocs} emailsAnalyzed=${report.emailsAnalyzed} hiddenSkipped=${report.hiddenSkipped} excluded=${report.excluded} contacts=${report.contactsBuilt}`,
  );
  return { contacts, report };
}
