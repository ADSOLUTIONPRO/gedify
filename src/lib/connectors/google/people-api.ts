import "server-only";

import { getAccessTokenForAccount } from "@/lib/connectors/gmail/gmail-api";

const PEOPLE_API_BASE = "https://people.googleapis.com/v1";

export const DEFAULT_PEOPLE_SCOPES = [
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts.other.readonly",
];

export type GooglePersonName = {
  displayName?: string;
  givenName?: string;
  familyName?: string;
};

export type GooglePersonEmail = {
  value: string;
  type?: string;
  formattedType?: string;
};

export type GooglePersonPhone = {
  value: string;
  type?: string;
};

export type GooglePersonOrganization = {
  name?: string;
  title?: string;
};

export type GooglePerson = {
  resourceName: string;
  etag?: string;
  names?: GooglePersonName[];
  emailAddresses?: GooglePersonEmail[];
  phoneNumbers?: GooglePersonPhone[];
  organizations?: GooglePersonOrganization[];
};

const PERSON_FIELDS = "names,emailAddresses,phoneNumbers,organizations";

async function peopleFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${PEOPLE_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`People API ${response.status} on ${path}: ${text.slice(0, 400)}`);
  }
  return response.json() as Promise<T>;
}

/**
 * List the user's own contacts (My Contacts). Requires
 * `https://www.googleapis.com/auth/contacts.readonly`.
 */
export async function listPeopleConnections(
  accountId: string,
  pageSize = 200,
  pageToken?: string
): Promise<{ connections: GooglePerson[]; nextPageToken?: string; totalItems?: number }> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const search = new URLSearchParams({
    personFields: PERSON_FIELDS,
    pageSize: String(pageSize),
    sortOrder: "LAST_MODIFIED_DESCENDING",
  });
  if (pageToken) search.set("pageToken", pageToken);
  const data = await peopleFetch<{
    connections?: GooglePerson[];
    nextPageToken?: string;
    totalItems?: number;
  }>(accessToken, `/people/me/connections?${search.toString()}`);
  return {
    connections: data.connections ?? [],
    nextPageToken: data.nextPageToken,
    totalItems: data.totalItems,
  };
}

/**
 * List "Other contacts" (people the user has interacted with but not added).
 * Requires `https://www.googleapis.com/auth/contacts.other.readonly`.
 */
export async function listOtherContacts(
  accountId: string,
  pageSize = 200,
  pageToken?: string
): Promise<{ contacts: GooglePerson[]; nextPageToken?: string }> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const search = new URLSearchParams({
    readMask: "names,emailAddresses",
    pageSize: String(pageSize),
  });
  if (pageToken) search.set("pageToken", pageToken);
  const data = await peopleFetch<{
    otherContacts?: GooglePerson[];
    nextPageToken?: string;
  }>(accessToken, `/otherContacts?${search.toString()}`);
  return {
    contacts: data.otherContacts ?? [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Search across the user's people directory and other contacts.
 * `query` must be a substring of name or email.
 */
export async function searchPeople(
  accountId: string,
  query: string,
  pageSize = 30
): Promise<GooglePerson[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  const accessToken = await getAccessTokenForAccount(accountId);
  const search = new URLSearchParams({
    query: trimmed,
    readMask: PERSON_FIELDS,
    pageSize: String(pageSize),
  });
  const data = await peopleFetch<{ results?: { person?: GooglePerson }[] }>(
    accessToken,
    `/people:searchContacts?${search.toString()}`
  );
  return (data.results ?? [])
    .map((r) => r.person)
    .filter((p): p is GooglePerson => Boolean(p));
}

/**
 * Normalise un `GooglePerson` brut vers une représentation plate pour l'UI.
 */
export function flattenPerson(person: GooglePerson): {
  resourceName: string;
  displayName: string;
  email: string | null;
  emails: string[];
  phone: string | null;
  organization: string | null;
} {
  const displayName =
    person.names?.[0]?.displayName ??
    [person.names?.[0]?.givenName, person.names?.[0]?.familyName]
      .filter(Boolean)
      .join(" ") ??
    person.emailAddresses?.[0]?.value ??
    "Contact";
  const emails = (person.emailAddresses ?? [])
    .map((e) => e.value?.trim())
    .filter((v): v is string => Boolean(v));
  return {
    resourceName: person.resourceName,
    displayName,
    email: emails[0] ?? null,
    emails,
    phone: person.phoneNumbers?.[0]?.value ?? null,
    organization:
      person.organizations?.[0]?.name ?? person.organizations?.[0]?.title ?? null,
  };
}
