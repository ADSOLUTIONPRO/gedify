import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   Extraction de texte des documents BUREAUTIQUES (Word & tableurs), 100 % JS et
   hors-ligne, pour les rendre LISIBLES (consultation du contenu, recherche
   plein-texte, analyse IA) au même titre qu'un PDF.

   - Word (.docx/.dotx/.docm) → texte brut via `mammoth`.
   - Tableurs (.xlsx/.xls/.xlsm/.xlsb/.ods) → CSV par feuille via `xlsx` (SheetJS),
     ce qui couvre aussi les exports Google Sheets (.xlsx/.ods).

   Best-effort : en cas d'échec, on renvoie "" (le document reste importé,
   consultable et téléchargeable, simplement sans couche texte). Les imports sont
   DYNAMIQUES pour ne charger ces libs que lorsqu'un tel fichier est traité.
   ──────────────────────────────────────────────────────────────────────── */

const WORD_EXT = new Set([".docx", ".dotx", ".docm"]);
const SHEET_EXT = new Set([".xlsx", ".xls", ".xlsm", ".xlsb", ".ods", ".fods"]);

/** Vrai si l'extension correspond à un format bureautique extractible ici. */
export function isOfficeText(ext: string): boolean {
  const e = ext.toLowerCase();
  return WORD_EXT.has(e) || SHEET_EXT.has(e);
}

async function extractWord(buf: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return (value ?? "").trim();
  } catch (e) {
    console.warn("[engine/office] document Word illisible :", e instanceof Error ? e.message : e);
    return "";
  }
}

async function extractSheet(buf: Buffer): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      if (csv.trim()) parts.push(`# ${name}\n${csv}`);
    }
    return parts.join("\n\n").trim();
  } catch (e) {
    console.warn("[engine/office] tableur illisible :", e instanceof Error ? e.message : e);
    return "";
  }
}

/** Extrait le texte d'un fichier bureautique selon son extension. */
export async function extractOfficeText(buf: Buffer, ext: string): Promise<string> {
  const e = ext.toLowerCase();
  if (WORD_EXT.has(e)) return extractWord(buf);
  if (SHEET_EXT.has(e)) return extractSheet(buf);
  return "";
}
