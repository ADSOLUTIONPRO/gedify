/**
 * Normalise un texte OCR pour un stockage SÛR (jsonb Postgres / JSON / SQLite)
 * sans en détruire le contenu.
 *
 * Cause de « unsupported Unicode escape sequence » : Postgres REFUSE le caractère
 * NULL (U+0000) — et plus largement les caractères de contrôle invalides — dans
 * une colonne `jsonb`. Le texte OCR brut en contient parfois (mauvaise
 * reconnaissance, PDF corrompus). On les retire ici, on conserve tabulations,
 * sauts de ligne et retours chariot, et on normalise en NFC (accents stables).
 *
 * Important : le texte reste du TEXTE BRUT en mémoire ; la sérialisation JSON est
 * faite par `JSON.stringify` côté store (jamais par concaténation de chaînes).
 */
export function normalizeOcrText(input: string | null | undefined): string {
  if (!input) return "";
  // `\p{Cc}` = catégorie Unicode « Control » (C0/C1). On retire tous ces
  // caractères SAUF tabulation (9), saut de ligne (10) et retour chariot (13).
  let out = input.replace(/\p{Cc}/gu, (ch) => {
    const c = ch.charCodeAt(0);
    return c === 9 || c === 10 || c === 13 ? ch : "";
  });
  try {
    out = out.normalize("NFC");
  } catch {
    /* environnement sans normalize : on conserve la version nettoyée */
  }
  return out;
}
