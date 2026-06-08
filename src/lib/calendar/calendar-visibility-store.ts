/* ────────────────────────────────────────────────────────────────────────
   Store CLIENT de visibilité des agendas (cases on/off façon Google Calendar).
   La sidebar (cases à cocher) et les vues temporelles (filtrage) sont des
   composants frères sans état React partagé : on passe par localStorage + un
   évènement window pour synchroniser l'affichage sans remonter d'état serveur.
   ──────────────────────────────────────────────────────────────────────── */

const KEY = "gedify.calendar.hidden";
const EVENT = "gedify-calendar-visibility";

/** Identifiants d'agendas actuellement MASQUÉS. */
export function getHiddenCalendars(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Masque ou affiche un agenda et notifie les abonnés. */
export function setCalendarHidden(calendarId: string, hidden: boolean): void {
  if (typeof window === "undefined") return;
  const set = getHiddenCalendars();
  if (hidden) set.add(calendarId);
  else set.delete(calendarId);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* quota / mode privé : on ignore, l'affichage reste cohérent en mémoire */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** S'abonne aux changements de visibilité (même onglet + autres onglets). */
export function subscribeCalendarVisibility(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
