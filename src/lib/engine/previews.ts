import "server-only";

import sharp from "sharp";
import { loadPdf, renderPdfPageToPng } from "./pdf";

/* ────────────────────────────────────────────────────────────────────────
   Aperçus (previews) : image moyenne résolution de la 1ʳᵉ page / de l'image,
   pour un affichage net dans la fiche document et le survol de la grille — sans
   charger le PDF original. Distinct des miniatures (petites) et de l'original.
   Toujours best-effort : renvoie null si on ne sait pas générer (l'appelant
   conserve alors la miniature / le placeholder).
   ──────────────────────────────────────────────────────────────────────── */

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"];
const W = 1240;
const H = 1754; // ratio ~A4

export async function makePreview(buf: Buffer, mime: string, ext: string): Promise<Buffer | null> {
  const lower = ext.toLowerCase();
  try {
    if (mime.startsWith("image/") || IMAGE_EXT.includes(lower)) {
      return await sharp(buf, { failOn: "none" })
        .rotate()
        .flatten({ background: "#ffffff" })
        .resize(W, H, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    }
    if (mime === "application/pdf" || lower === ".pdf") {
      const doc = await loadPdf(buf);
      if (doc) {
        const png = await renderPdfPageToPng(doc, 1, 2.5);
        await doc.destroy?.().catch(() => {});
        if (png) {
          return await sharp(png)
            .flatten({ background: "#ffffff" })
            .resize(W, H, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
        }
      }
    }
  } catch (e) {
    console.error("[engine/preview] génération échouée :", e instanceof Error ? e.message : e);
  }
  return null;
}
