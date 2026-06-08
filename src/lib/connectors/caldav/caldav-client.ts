import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   Client CalDAV minimal (RFC 4791) pour iCloud et serveurs compatibles.
   Authentification Basic (Apple ID + mot de passe d'application). Découverte
   principal → calendar-home-set, liste des agendas, REPORT calendar-query,
   PUT/DELETE d'événements. Parsing XML tolérant (préfixes de namespace
   ignorés). Sans dépendance externe.
   ──────────────────────────────────────────────────────────────────────── */

export type CalDavAuth = { username: string; password: string };
export type CalDavCalendar = { url: string; displayName: string; color: string | null };
export type CalDavObject = { href: string; etag: string | null; ics: string };

export function basicAuth(auth: CalDavAuth): string {
  return `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`;
}

async function caldavFetch(
  url: string,
  method: string,
  auth: CalDavAuth,
  opts: { depth?: "0" | "1"; body?: string; contentType?: string; etag?: string; ifNoneMatch?: boolean } = {},
): Promise<Response> {
  const headers: Record<string, string> = { Authorization: basicAuth(auth) };
  if (opts.depth) headers.Depth = opts.depth;
  if (opts.body) headers["Content-Type"] = opts.contentType ?? 'application/xml; charset="utf-8"';
  if (opts.etag) headers["If-Match"] = opts.etag;
  if (opts.ifNoneMatch) headers["If-None-Match"] = "*";
  const res = await fetch(url, { method, headers, body: opts.body });
  if (res.status === 401) throw new Error("CALDAV_AUTH: identifiants refusés (Apple ID / mot de passe d'application).");
  return res;
}

function resolveUrl(base: string, href: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function unescapeXml(v: string): string {
  return v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#13;/g, "\r").replace(/&#10;/g, "\n").replace(/&amp;/g, "&");
}

/** Extrait le contenu du premier élément de nom local `local` (préfixe ignoré). */
function tagContent(xml: string, local: string): string | null {
  const re = new RegExp(`<(?:[a-z0-9]+:)?${local}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9]+:)?${local}>`, "i");
  return xml.match(re)?.[1] ?? null;
}

/** href contenu dans le premier élément `prop` (ex. current-user-principal). */
function hrefInProp(xml: string, propLocal: string): string | null {
  const block = tagContent(xml, propLocal);
  if (!block) return null;
  return tagContent(block, "href")?.trim() ?? null;
}

/** Découpe un multistatus en blocs <response>. */
function splitResponses(xml: string): string[] {
  return [...xml.matchAll(/<(?:[a-z0-9]+:)?response[\s>][\s\S]*?<\/(?:[a-z0-9]+:)?response>/gi)].map((m) => m[0]);
}

const PROPFIND_PRINCIPAL = '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>';
const PROPFIND_HOME = '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>';
const PROPFIND_CALENDARS = '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:ic="http://apple.com/ns/ical/"><d:prop><d:displayname/><d:resourcetype/><ic:calendar-color/><c:supported-calendar-component-set/></d:prop></d:propfind>';

/** Découvre l'URL du principal puis du calendar-home-set. */
export async function discover(serverUrl: string, auth: CalDavAuth): Promise<{ principalUrl: string; homeUrl: string }> {
  const res1 = await caldavFetch(serverUrl, "PROPFIND", auth, { depth: "0", body: PROPFIND_PRINCIPAL });
  const xml1 = await res1.text();
  const principalHref = hrefInProp(xml1, "current-user-principal") ?? "/";
  const principalUrl = resolveUrl(serverUrl, principalHref);

  const res2 = await caldavFetch(principalUrl, "PROPFIND", auth, { depth: "0", body: PROPFIND_HOME });
  const xml2 = await res2.text();
  const homeHref = hrefInProp(xml2, "calendar-home-set") ?? principalHref;
  const homeUrl = resolveUrl(principalUrl, homeHref);
  return { principalUrl, homeUrl };
}

/** Liste les agendas (collections calendar) du calendar-home-set. */
export async function listCalendars(homeUrl: string, auth: CalDavAuth): Promise<CalDavCalendar[]> {
  const res = await caldavFetch(homeUrl, "PROPFIND", auth, { depth: "1", body: PROPFIND_CALENDARS });
  const xml = await res.text();
  const calendars: CalDavCalendar[] = [];
  for (const block of splitResponses(xml)) {
    const resourcetype = tagContent(block, "resourcetype") ?? "";
    if (!/<(?:[a-z0-9]+:)?calendar[\s/>]/i.test(resourcetype)) continue; // collections calendar uniquement
    const comp = tagContent(block, "supported-calendar-component-set") ?? "";
    if (comp && !/VEVENT/i.test(comp)) continue; // agendas d'événements
    const href = tagContent(block, "href")?.trim();
    if (!href) continue;
    const displayName = (tagContent(block, "displayname") ?? "Agenda iCloud").trim() || "Agenda iCloud";
    const colorRaw = tagContent(block, "calendar-color")?.trim() ?? null;
    const color = colorRaw ? colorRaw.slice(0, 7) : null; // #RRGGBBAA → #RRGGBB
    calendars.push({ url: resolveUrl(homeUrl, href), displayName, color });
  }
  return calendars;
}

/** REPORT calendar-query : objets VEVENT d'un agenda sur une plage temporelle. */
export async function listCalendarObjects(calendarUrl: string, auth: CalDavAuth, from: string, to: string): Promise<CalDavObject[]> {
  const stamp = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`; };
  const body = `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${stamp(from)}" end="${stamp(to)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const res = await caldavFetch(calendarUrl, "REPORT", auth, { depth: "1", body });
  const xml = await res.text();
  const objects: CalDavObject[] = [];
  for (const block of splitResponses(xml)) {
    const href = tagContent(block, "href")?.trim();
    const data = tagContent(block, "calendar-data");
    if (!href || !data) continue;
    objects.push({ href: resolveUrl(calendarUrl, href), etag: tagContent(block, "getetag")?.trim() ?? null, ics: unescapeXml(data).trim() });
  }
  return objects;
}

/** Crée/met à jour un objet calendrier (.ics). Renvoie l'etag si fourni. */
export async function putEvent(url: string, ics: string, auth: CalDavAuth, etag?: string): Promise<{ etag: string | null }> {
  const res = await caldavFetch(url, "PUT", auth, { body: ics, contentType: 'text/calendar; charset="utf-8"', etag, ifNoneMatch: !etag });
  if (!res.ok && res.status !== 201 && res.status !== 204) throw new Error(`CalDAV PUT ${res.status} on ${url}`);
  return { etag: res.headers.get("ETag") };
}

/** Supprime un objet calendrier. */
export async function deleteEvent(url: string, auth: CalDavAuth, etag?: string): Promise<void> {
  const res = await caldavFetch(url, "DELETE", auth, { etag });
  if (!res.ok && res.status !== 204 && res.status !== 404) throw new Error(`CalDAV DELETE ${res.status} on ${url}`);
}
