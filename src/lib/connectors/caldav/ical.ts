import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   Mini iCalendar (RFC 5545) — sous-ensemble VEVENT suffisant pour CalDAV
   (iCloud). Génère/parse les champs courants : UID, SUMMARY, DESCRIPTION,
   LOCATION, DTSTART/DTEND (DATE ou DATE-TIME), RRULE. Sans dépendance.
   Limites connues : pas de gestion fine des fuseaux (TZID traité en heure
   locale), pas de VALARM/participants au parsing. Suffit pour lecture/écriture
   d'événements simples ; à étendre au besoin.
   ──────────────────────────────────────────────────────────────────────── */

export type ICalEvent = {
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  start: string;       // ISO
  end?: string | null; // ISO
  allDay: boolean;
  rrule?: string | null;
};

function pad(n: number): string { return String(n).padStart(2, "0"); }

/** Échappe une valeur texte iCalendar (RFC 5545 §3.3.11). */
function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function unesc(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function toUTCStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function toDateStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** Construit un VCALENDAR mono-événement prêt à PUT. */
export function buildICS(ev: ICalEvent): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GEDify//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${toUTCStamp(new Date().toISOString())}`,
    `SUMMARY:${esc(ev.summary || "Sans titre")}`,
  ];
  if (ev.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${toDateStamp(ev.start)}`);
    const end = ev.end ?? ev.start;
    const endD = new Date(end); endD.setDate(endD.getDate() + 1); // DTEND exclusif
    lines.push(`DTEND;VALUE=DATE:${toDateStamp(endD.toISOString())}`);
  } else {
    lines.push(`DTSTART:${toUTCStamp(ev.start)}`);
    lines.push(`DTEND:${toUTCStamp(ev.end ?? ev.start)}`);
  }
  if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
  if (ev.rrule) lines.push(`RRULE:${ev.rrule.replace(/^RRULE:/, "")}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Déplie les lignes (continuation par espace/tab en début de ligne). */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

/** Convertit une valeur DATE / DATE-TIME iCalendar en ISO + drapeau allDay. */
function parseDate(value: string, isDate: boolean): { iso: string; allDay: boolean } {
  if (isDate || /^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4), m = +value.slice(4, 6), d = +value.slice(6, 8);
    return { iso: new Date(y, m - 1, d, 0, 0, 0).toISOString(), allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return { iso: new Date(value).toISOString(), allDay: false };
  const [, y, mo, da, h, mi, s, z] = m;
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi, +s))
    : new Date(+y, +mo - 1, +da, +h, +mi, +s); // sans Z / TZID : heure locale (best-effort)
  return { iso: date.toISOString(), allDay: false };
}

/** Parse un VCALENDAR et renvoie ses VEVENT. */
export function parseICS(text: string): ICalEvent[] {
  const lines = unfold(text);
  const events: ICalEvent[] = [];
  let cur: Partial<ICalEvent> | null = null;
  let endExclusiveAllDay = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = { allDay: false }; endExclusiveAllDay = false; continue; }
    if (line === "END:VEVENT") {
      if (cur?.uid && cur.start) {
        // DTEND d'un all-day est exclusif → on retranche un jour pour l'affichage.
        if (endExclusiveAllDay && cur.end) { const d = new Date(cur.end); d.setDate(d.getDate() - 1); cur.end = d.toISOString(); }
        events.push({ uid: cur.uid, summary: cur.summary ?? "Sans titre", description: cur.description ?? null, location: cur.location ?? null, start: cur.start, end: cur.end ?? null, allDay: cur.allDay ?? false, rrule: cur.rrule ?? null });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...params] = rawKey.split(";");
    const isDateParam = params.some((p) => /VALUE=DATE$/i.test(p));
    switch (name.toUpperCase()) {
      case "UID": cur.uid = value.trim(); break;
      case "SUMMARY": cur.summary = unesc(value); break;
      case "DESCRIPTION": cur.description = unesc(value); break;
      case "LOCATION": cur.location = unesc(value); break;
      case "RRULE": cur.rrule = value.trim(); break;
      case "DTSTART": { const p = parseDate(value.trim(), isDateParam); cur.start = p.iso; cur.allDay = p.allDay; break; }
      case "DTEND": { const p = parseDate(value.trim(), isDateParam); cur.end = p.iso; if (p.allDay) endExclusiveAllDay = true; break; }
      default: break;
    }
  }
  return events;
}
