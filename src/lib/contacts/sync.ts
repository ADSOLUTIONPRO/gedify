import "server-only";

import {
  flattenPerson,
  listOtherContacts,
  listPeopleConnections,
} from "@/lib/connectors/google/people-api";
import { findBestCorrespondentMatch } from "@/lib/contacts/contact-correspondent-matcher";
import { bulkUpsertEmailContacts, listEmailContacts } from "@/lib/messaging/email-contact-store";
import type { EmailContactRecord } from "@/lib/messaging/email-types";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { getCorrespondents } from "@/lib/paperless";
import { loadThreads } from "@/lib/messaging/load-threads";

/* ────────────────────────────────────────────────────────────────────────
   Synchronisation des contacts (Google People + détection emails), factorisée
   pour être réutilisée par : les routes manuelles, le bouton « Tout
   synchroniser », et le job périodique. Ne logge aucun secret ni contenu d'email.
   ──────────────────────────────────────────────────────────────────────── */

export type SyncErrorType =
  | "no_account" | "missing_scope" | "people_api_disabled"
  | "token_expired" | "needs_reconnect" | "error";

export type GoogleSyncResult =
  | { ok: true; synced: number; myContactsCount: number; otherContactsCount: number }
  | { ok: false; errorType: SyncErrorType; message: string; httpStatus: number };

export type EmailSyncResult =
  | { ok: true; detected: number; created: number; skippedDuplicates: number }
  | { ok: false; errorType: SyncErrorType; message: string; httpStatus: number };

/** Classe une erreur People API en type exploitable côté UI. */
function classifyGoogleError(msg: string): { errorType: SyncErrorType; message: string; httpStatus: number } {
  if (/SERVICE_DISABLED|has not been used in project|API has not been enabled|accessNotConfigured/i.test(msg)) {
    return {
      errorType: "people_api_disabled",
      message: "La People API n'est pas activée pour ce projet Google Cloud. Activez-la (console Google Cloud › APIs & Services › People API › Activer), puis réessayez.",
      httpStatus: 503,
    };
  }
  if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient.{0,20}scopes|PERMISSION_DENIED|People API 403/i.test(msg)) {
    return {
      errorType: "missing_scope",
      message: "Autorisation Google Contacts insuffisante. Reconnectez votre compte Google (Paramètres) pour accorder l'accès aux contacts.",
      httpStatus: 403,
    };
  }
  if (/People API 401|invalid_grant|UNAUTHENTICATED|token.{0,10}(expired|expir)/i.test(msg)) {
    return {
      errorType: "token_expired",
      message: "Session Google expirée. Reconnectez votre compte Google (Paramètres).",
      httpStatus: 401,
    };
  }
  return { errorType: "error", message: "Synchronisation des contacts Google impossible.", httpStatus: 500 };
}

/** Synchronise les contacts Google (My Contacts + Other Contacts best-effort). */
export async function syncGoogleContacts(): Promise<GoogleSyncResult> {
  const account = await getActiveGmailAccount();
  if (!account) {
    return { ok: false, errorType: "no_account", message: "Aucun compte Google connecté.", httpStatus: 412 };
  }
  if (!account.scopes?.some((s) => s.includes("contacts"))) {
    return {
      ok: false,
      errorType: "missing_scope",
      message: "Autorisation Google Contacts manquante. Reconnectez votre compte Google (Paramètres) pour accorder l'accès aux contacts.",
      httpStatus: 403,
    };
  }
  try {
    const myContacts = await listPeopleConnections(account.accountId, 500);
    let other: Awaited<ReturnType<typeof listOtherContacts>> = { contacts: [] };
    try {
      other = await listOtherContacts(account.accountId, 200);
    } catch {
      /* scope additionnel requis → ignoré (best-effort) */
    }

    const correspondentsData = await getCorrespondents({ page_size: 1000 });
    const correspondents = correspondentsData.results ?? [];
    const existing = await listEmailContacts(account.accountId);
    const existingByResource = new Map(existing.map((c) => [c.resourceName, c]));

    const now = new Date().toISOString();
    const records: EmailContactRecord[] = [];
    const buildRecord = (person: Parameters<typeof flattenPerson>[0], source: "people" | "other_contacts") => {
      const flat = flattenPerson(person);
      if (!flat.email && flat.emails.length === 0) return;
      if (source === "other_contacts" && !flat.email) return;
      const prior = existingByResource.get(person.resourceName);
      const match = prior?.correspondentId
        ? null
        : findBestCorrespondentMatch({ displayName: flat.displayName, email: flat.email, organization: flat.organization }, correspondents);
      records.push({
        resourceName: person.resourceName,
        accountId: account.accountId,
        accountEmail: account.email,
        displayName: flat.displayName,
        email: flat.email,
        emails: flat.emails,
        phone: flat.phone,
        organization: flat.organization,
        source,
        correspondentId: prior?.correspondentId ?? null,
        suggestedCorrespondentId: match ? Number(match.correspondent.id) : null,
        suggestedScore: match ? Number(match.score.toFixed(2)) : null,
        status: prior?.correspondentId ? "linked" : match ? "suggested" : "new",
        updatedAt: now,
      });
    };

    for (const person of myContacts.connections) buildRecord(person, "people");
    for (const person of other.contacts) buildRecord(person, "other_contacts");

    await bulkUpsertEmailContacts(records);
    return {
      ok: true,
      synced: records.length,
      myContactsCount: myContacts.connections.length,
      otherContactsCount: other.contacts.length,
    };
  } catch (error) {
    const c = classifyGoogleError(error instanceof Error ? error.message : String(error));
    return { ok: false, ...c };
  }
}

/** Détecte les contacts depuis les emails (expéditeurs/destinataires inbox+sent). */
export async function syncEmailContacts(): Promise<EmailSyncResult> {
  const account = await getActiveGmailAccount();
  if (!account) {
    return { ok: false, errorType: "no_account", message: "Aucune boîte mail connectée.", httpStatus: 412 };
  }
  const [inbox, sent] = await Promise.all([loadThreads("in:inbox", 80), loadThreads("in:sent", 40)]);
  if (!inbox.connected) {
    return { ok: false, errorType: "needs_reconnect", message: "Boîte mail à reconnecter (session expirée).", httpStatus: 412 };
  }

  const selfEmail = account.email.toLowerCase();
  const existing = await listEmailContacts();
  const known = new Set<string>();
  for (const c of existing) {
    if (c.email) known.add(c.email.toLowerCase());
    for (const e of c.emails ?? []) known.add(e.toLowerCase());
  }

  const detected = new Map<string, { email: string; name: string | null }>();
  const collect = (threads: typeof inbox.threads) => {
    for (const t of threads) {
      for (const p of t.participants ?? []) {
        const email = (p.email ?? "").trim().toLowerCase();
        if (!email || email === selfEmail) continue;
        const prev = detected.get(email);
        if (!prev || (!prev.name && p.name)) detected.set(email, { email, name: p.name ?? null });
      }
    }
  };
  collect(inbox.threads);
  if (sent.connected) collect(sent.threads);

  const correspondentsData = await getCorrespondents({ page_size: 1000 });
  const correspondents = correspondentsData.results ?? [];
  const now = new Date().toISOString();
  const records: EmailContactRecord[] = [];
  let skippedDuplicates = 0;

  for (const { email, name } of detected.values()) {
    if (known.has(email)) { skippedDuplicates += 1; continue; }
    const displayName = name || email.split("@")[0];
    const match = findBestCorrespondentMatch({ displayName, email, organization: null }, correspondents);
    records.push({
      resourceName: `email:${email}`,
      accountId: account.accountId,
      accountEmail: account.email,
      displayName,
      email,
      emails: [email],
      phone: null,
      organization: null,
      source: "imap_email",
      correspondentId: null,
      suggestedCorrespondentId: match ? Number(match.correspondent.id) : null,
      suggestedScore: match ? Number(match.score.toFixed(2)) : null,
      status: match ? "suggested" : "new",
      updatedAt: now,
    });
  }

  if (records.length > 0) await bulkUpsertEmailContacts(records);
  return { ok: true, detected: detected.size, created: records.length, skippedDuplicates };
}

/** Synchronise TOUT (Google + emails). Best-effort : un échec d'une source
 *  n'empêche pas l'autre. Renvoie le détail par source. */
export async function syncAllContacts(): Promise<{ google: GoogleSyncResult; email: EmailSyncResult; outlook?: { synced: number } }> {
  const google = await syncGoogleContacts();
  const email = await syncEmailContacts();
  // Contacts Microsoft (Graph) des comptes Outlook connectés — best-effort.
  let outlookSynced = 0;
  try {
    const { listAccounts } = await import("@/lib/mail-connector/account-store");
    const { syncOutlookContacts } = await import("@/lib/connectors/outlook/sync-outlook-contacts");
    const outlookAccounts = (await listAccounts()).filter((a) => a.authType === "oauth-outlook" && a.isActive);
    for (const acc of outlookAccounts) {
      const r = await syncOutlookContacts(acc.id);
      if (r.ok) outlookSynced += r.synced ?? 0;
    }
  } catch {
    /* best-effort : n'empêche pas Google/email */
  }
  return { google, email, outlook: { synced: outlookSynced } };
}
