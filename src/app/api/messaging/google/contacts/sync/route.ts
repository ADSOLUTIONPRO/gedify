import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  flattenPerson,
  listOtherContacts,
  listPeopleConnections,
} from "@/lib/connectors/google/people-api";
import { findBestCorrespondentMatch } from "@/lib/contacts/contact-correspondent-matcher";
import {
  bulkUpsertEmailContacts,
  listEmailContacts,
} from "@/lib/messaging/email-contact-store";
import type { EmailContactRecord } from "@/lib/messaging/email-types";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { getCorrespondents } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const account = await getActiveGmailAccount();
    if (!account) {
      return NextResponse.json(
        { error: "no_account", message: "Aucun compte Google connecté." },
        { status: 412 },
      );
    }

    // Vérifie en amont que l'autorisation Contacts a bien été accordée (le jeton
    // peut dater d'avant l'ajout du scope) → message clair plutôt qu'un 500 People API.
    if (!account.scopes?.some((s) => s.includes("contacts"))) {
      return NextResponse.json(
        {
          error: "missing_scope",
          errorType: "missing_scope",
          message:
            "Autorisation Google Contacts manquante. Reconnectez votre compte Google (Paramètres) pour accorder l'accès aux contacts.",
        },
        { status: 403 },
      );
    }

    // 1. Récupère "my contacts" (et "other contacts" en best-effort).
    const myContacts = await listPeopleConnections(account.accountId, 500);
    let other: Awaited<ReturnType<typeof listOtherContacts>> = { contacts: [] };
    try {
      other = await listOtherContacts(account.accountId, 200);
    } catch {
      // L'API "other_contacts" exige un scope additionnel. On ignore l'erreur
      // pour ne pas bloquer le sync principal.
    }

    // 2. Charge les correspondants Gedify existants pour matcher.
    const correspondentsData = await getCorrespondents({ page_size: 1000 });
    const correspondents = correspondentsData.results ?? [];

    // 3. Index des contacts déjà stockés pour préserver le `correspondentId`
    //    et le `status` choisis par l'utilisateur.
    const existing = await listEmailContacts(account.accountId);
    const existingByResource = new Map(existing.map((c) => [c.resourceName, c]));

    const now = new Date().toISOString();
    const records: EmailContactRecord[] = [];

    for (const person of myContacts.connections) {
      const flat = flattenPerson(person);
      if (!flat.email && flat.emails.length === 0) continue;
      const prior = existingByResource.get(person.resourceName);

      const match = prior?.correspondentId
        ? null
        : findBestCorrespondentMatch(
            {
              displayName: flat.displayName,
              email: flat.email,
              organization: flat.organization,
            },
            correspondents,
          );

      records.push({
        resourceName: person.resourceName,
        accountId: account.accountId,
        accountEmail: account.email,
        displayName: flat.displayName,
        email: flat.email,
        emails: flat.emails,
        phone: flat.phone,
        organization: flat.organization,
        source: "people",
        correspondentId: prior?.correspondentId ?? null,
        suggestedCorrespondentId: match ? Number(match.correspondent.id) : null,
        suggestedScore: match ? Number(match.score.toFixed(2)) : null,
        status: prior?.correspondentId
          ? "linked"
          : match
          ? "suggested"
          : "new",
        updatedAt: now,
      });
    }

    for (const person of other.contacts) {
      const flat = flattenPerson(person);
      if (!flat.email) continue;
      const prior = existingByResource.get(person.resourceName);
      const match = prior?.correspondentId
        ? null
        : findBestCorrespondentMatch(
            {
              displayName: flat.displayName,
              email: flat.email,
              organization: flat.organization,
            },
            correspondents,
          );
      records.push({
        resourceName: person.resourceName,
        accountId: account.accountId,
        accountEmail: account.email,
        displayName: flat.displayName,
        email: flat.email,
        emails: flat.emails,
        phone: flat.phone,
        organization: flat.organization,
        source: "other_contacts",
        correspondentId: prior?.correspondentId ?? null,
        suggestedCorrespondentId: match ? Number(match.correspondent.id) : null,
        suggestedScore: match ? Number(match.score.toFixed(2)) : null,
        status: prior?.correspondentId
          ? "linked"
          : match
          ? "suggested"
          : "new",
        updatedAt: now,
      });
    }

    await bulkUpsertEmailContacts(records);

    return NextResponse.json({
      accountId: account.accountId,
      synced: records.length,
      myContactsCount: myContacts.connections.length,
      otherContactsCount: other.contacts.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/SERVICE_DISABLED|has not been used in project|API has not been enabled|accessNotConfigured/i.test(msg)) {
      return NextResponse.json(
        {
          error: "people_api_disabled",
          errorType: "people_api_disabled",
          message:
            "La People API n'est pas activée pour ce projet Google Cloud. Activez-la (console Google Cloud › APIs & Services › People API › Activer), puis réessayez.",
        },
        { status: 503 },
      );
    }
    if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient.{0,20}scopes|PERMISSION_DENIED|People API 403/i.test(msg)) {
      return NextResponse.json(
        {
          error: "missing_scope",
          errorType: "missing_scope",
          message:
            "Autorisation Google Contacts insuffisante. Reconnectez votre compte Google (Paramètres) pour accorder l'accès aux contacts.",
        },
        { status: 403 },
      );
    }
    if (/People API 401|invalid_grant|UNAUTHENTICATED|token.{0,10}(expired|expir)/i.test(msg)) {
      return NextResponse.json(
        {
          error: "token_expired",
          errorType: "token_expired",
          message: "Session Google expirée. Reconnectez votre compte Google (Paramètres).",
        },
        { status: 401 },
      );
    }
    return jsonError("Synchronisation des contacts Google impossible", error);
  }
}
