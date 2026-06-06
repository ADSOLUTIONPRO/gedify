import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { loadThreads } from "@/lib/messaging/load-threads";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { findBestCorrespondentMatch } from "@/lib/contacts/contact-correspondent-matcher";
import { bulkUpsertEmailContacts, listEmailContacts } from "@/lib/messaging/email-contact-store";
import type { EmailContactRecord } from "@/lib/messaging/email-types";
import { getCorrespondents } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/sync/email
 *
 * Détecte les CONTACTS depuis les emails synchronisés (expéditeurs + destinataires
 * de la boîte connectée), et les enregistre comme contacts `imap_email`. Ne crée
 * jamais de doublon avec un contact existant portant la même adresse (Google ou
 * autre) : on saute alors l'adresse. Ne logge aucun contenu d'email.
 */
export async function POST() {
  try {
    const account = await getActiveGmailAccount();
    if (!account) {
      return NextResponse.json(
        { error: "no_account", message: "Aucune boîte mail connectée." },
        { status: 412 },
      );
    }

    // Threads reçus + envoyés → expéditeurs ET destinataires fréquents.
    const [inbox, sent] = await Promise.all([
      loadThreads("in:inbox", 80),
      loadThreads("in:sent", 40),
    ]);
    if (!inbox.connected) {
      return NextResponse.json(
        { error: "needs_reconnect", message: "Boîte mail à reconnecter (session expirée)." },
        { status: 412 },
      );
    }

    const selfEmail = account.email.toLowerCase();
    // Adresses déjà couvertes par un contact existant (toutes sources) → pas de doublon.
    const existing = await listEmailContacts();
    const known = new Set<string>();
    for (const c of existing) {
      if (c.email) known.add(c.email.toLowerCase());
      for (const e of c.emails ?? []) known.add(e.toLowerCase());
    }

    // Agrège les participants uniques (nom le plus informatif retenu).
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

    // Correspondants pour le matching.
    const correspondentsData = await getCorrespondents({ page_size: 1000 });
    const correspondents = correspondentsData.results ?? [];

    const now = new Date().toISOString();
    const records: EmailContactRecord[] = [];
    let skippedDuplicates = 0;

    for (const { email, name } of detected.values()) {
      if (known.has(email)) {
        skippedDuplicates += 1;
        continue; // déjà un contact (Google/manuel/autre) avec cette adresse
      }
      const displayName = name || email.split("@")[0];
      const match = findBestCorrespondentMatch(
        { displayName, email, organization: null },
        correspondents,
      );
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

    console.log(
      `[contacts] sync email account=${account.accountId} détectés=${detected.size} créés=${records.length} doublons-ignorés=${skippedDuplicates}`,
    );
    return NextResponse.json({
      accountId: account.accountId,
      detected: detected.size,
      created: records.length,
      skippedDuplicates,
    });
  } catch (error) {
    return jsonError("Détection des contacts depuis les emails impossible", error);
  }
}
