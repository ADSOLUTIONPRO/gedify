/* ────────────────────────────────────────────────────────────────────────
   Politique d'import GED — « tout type de document ».

   On accepte par défaut TOUS les fichiers : bureautique (Word, Excel,
   PowerPoint, OpenDocument, Apple iWork), PDF, images, texte, données, e-books,
   e-mails exportés… On REFUSE uniquement les fichiers vides, trop volumineux, et
   les exécutables/scripts (sécurité).

   Google Docs / Sheets / Slides ne sont pas des fichiers locaux : ils s'importent
   une fois EXPORTÉS depuis Google Drive (.docx / .xlsx / .pptx / .pdf / .csv) —
   tous ces formats sont pris en charge ici.
   ──────────────────────────────────────────────────────────────────────── */

export const IMPORT_MAX_BYTES = 100 * 1024 * 1024; // 100 Mo

/**
 * Liste (généreuse) pour l'attribut `accept` du sélecteur de fichiers — sert à
 * pré-filtrer la boîte de dialogue. Le glisser-déposer, lui, accepte TOUT fichier
 * non bloqué (l'attribut accept n'y est pas appliqué).
 */
export const IMPORT_ACCEPT = [
  ".pdf",
  // Images
  ".png,.jpg,.jpeg,.gif,.bmp,.webp,.tif,.tiff,.heic,.heif,.avif,.svg",
  // Traitement de texte
  ".doc,.docx,.dot,.dotx,.odt,.ott,.rtf,.txt,.md,.markdown,.pages",
  // Tableurs (inclut les exports Google Sheets)
  ".xls,.xlsx,.xlsm,.xlsb,.csv,.tsv,.ods,.numbers",
  // Présentations (inclut les exports Google Slides)
  ".ppt,.pptx,.odp,.key",
  // Données / web
  ".json,.xml,.html,.htm,.log,.yml,.yaml",
  // E-books / e-mails
  ".epub,.eml,.msg",
].join(",");

/** Extensions refusées pour raisons de sécurité (exécutables, scripts). */
const BLOCKED_EXT = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl", "jar",
  "js", "mjs", "cjs", "vbs", "vbe", "ps1", "psm1", "sh", "bash", "zsh",
  "app", "apk", "dmg", "pkg", "deb", "rpm", "bin", "dll", "sys", "so", "dylib",
]);

export type ImportValidation = { ok: true } | { ok: false; reason: string };

/** Valide un fichier candidat à l'import (commun à tous les points d'entrée). */
export function validateImportFile(file: { name: string; size: number }): ImportValidation {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (file.size === 0) return { ok: false, reason: "Fichier vide" };
  if (BLOCKED_EXT.has(ext)) return { ok: false, reason: "Type exécutable non autorisé (sécurité)" };
  if (file.size > IMPORT_MAX_BYTES) return { ok: false, reason: "Fichier trop volumineux (max 100 Mo)" };
  return { ok: true };
}
