export function formatDate(value?: string | null) {
  if (!value) {
    return "Non renseigné";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Non renseigné";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Formate une date détectée (IA / Gmail / Agenda) en `JJ-MM-AAAA` lisible.
 * Robuste aux valeurs invalides ou incohérentes (ex. mois 49, année 2063) :
 * renvoie « Date à vérifier » plutôt qu'une date impossible.
 * Une heure optionnelle (`HH:MM`) est ajoutée sous la forme « à HH:MM ».
 */
export function formatDetectedDate(value?: string | null, time?: string | null): string {
  if (!value) return "Date à vérifier";
  const raw = String(value).trim();

  let date = new Date(raw);
  // Fallback : formats français JJ/MM/AAAA ou JJ-MM-AAAA
  if (Number.isNaN(date.getTime())) {
    const m = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const yy = Number(m[3]);
      const y = yy < 100 ? 2000 + yy : yy;
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) date = new Date(y, mo - 1, d);
    }
  }

  if (Number.isNaN(date.getTime())) return "Date à vérifier";

  // Garde-fou : une date plausible (évite les conversions numériques absurdes).
  const year = date.getFullYear();
  const maxYear = new Date().getFullYear() + 10;
  if (year < 1990 || year > maxYear) return "Date à vérifier";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const text = `${dd}-${mm}-${year}`;
  const t = time && /^\d{1,2}:\d{2}/.test(String(time).trim()) ? ` à ${String(time).trim()}` : "";
  return text + t;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

export function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export function compactText(value?: string | null, maxLength = 160) {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}...`;
}
