import "server-only";

import sharp from "sharp";
import { loadPdf, renderPdfPageToPng } from "./pdf";

/* ────────────────────────────────────────────────────────────────────────
   Miniatures (remplace la génération de vignettes de Paperless).
   Images → sharp ; PDF → rendu 1ʳᵉ page (pdfjs + canvas) → sharp.
   Toujours une sortie : à défaut, une vignette « placeholder » typée.
   ──────────────────────────────────────────────────────────────────────── */

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"];
const W = 400;
const H = 560;

async function placeholder(ext: string): Promise<Buffer> {
  const label = (ext.replace(".", "").toUpperCase() || "DOC").slice(0, 4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#EEE7DC"/>
  <rect x="44" y="48" width="${W - 88}" height="${H - 96}" rx="18" fill="#FFFFFF" stroke="#D8C7B5" stroke-width="2"/>
  <text x="${W / 2}" y="${H / 2 + 18}" font-family="Inter, Arial, sans-serif" font-size="54" font-weight="700" fill="#B0894F" text-anchor="middle">${label}</text>
</svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

export async function makeThumbnail(buf: Buffer, mime: string, ext: string): Promise<Buffer> {
  const lower = ext.toLowerCase();
  try {
    if (mime.startsWith("image/") || IMAGE_EXT.includes(lower)) {
      return await sharp(buf, { failOn: "none" })
        .rotate()
        .resize(W, H, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
    }
    if (mime === "application/pdf" || lower === ".pdf") {
      const doc = await loadPdf(buf);
      if (doc) {
        const png = await renderPdfPageToPng(doc, 1, 2);
        await doc.destroy?.().catch(() => {});
        if (png) {
          return await sharp(png).resize(W, H, { fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
        }
      }
    }
  } catch (e) {
    console.error("[engine/thumb] génération échouée :", e instanceof Error ? e.message : e);
  }
  return placeholder(lower || mime.split("/").pop() || "");
}
