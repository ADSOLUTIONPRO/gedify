import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   Helpers PDF (pdfjs en Node + rendu raster via @napi-rs/canvas).
   Tout est best-effort : la moindre erreur renvoie null/[] sans casser
   l'ingestion (le document reste stocké, sans texte/miniature rendue).
   ──────────────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfPage = {
  getViewport(opts: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
  render(opts: any): { promise: Promise<void> };
};
export type PdfDoc = {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy?(): Promise<void>;
};

let canvasMod: any = null;
/**
 * Charge @napi-rs/canvas et expose ses classes Path2D/DOMMatrix/… en GLOBALS.
 *
 * pdfjs v6 capture les classes globales `Path2D`/`DOMMatrix` au moment de SON
 * import et ne dessine qu'avec elles. En Node ces globals n'existent pas, et
 * @napi-rs/canvas ne reconnaît que SES propres classes. Sans cette exposition
 * AVANT le premier import de pdfjs, le rendu échoue avec « Value is none of
 * these types `String`, `Path` » → toutes les vignettes PDF retombent sur le
 * placeholder. L'ordre (globals d'abord, pdfjs ensuite) est donc critique.
 */
async function canvasLib(): Promise<any> {
  if (!canvasMod) {
    canvasMod = await import("@napi-rs/canvas");
    const g = globalThis as any;
    g.Path2D ??= canvasMod.Path2D;
    g.DOMMatrix ??= canvasMod.DOMMatrix;
    g.ImageData ??= canvasMod.ImageData;
    g.DOMPoint ??= canvasMod.DOMPoint;
    g.DOMRect ??= canvasMod.DOMRect;
  }
  return canvasMod;
}

let pdfjsMod: any = null;
async function pdfjs(): Promise<any> {
  if (!pdfjsMod) {
    // Globals canvas posés AVANT l'import de pdfjs (ordre critique, cf. canvasLib).
    await canvasLib();
    // Build « legacy » = compatible Node (pas d'API navigateur requise).
    pdfjsMod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsMod;
}

export async function loadPdf(buf: Buffer): Promise<PdfDoc | null> {
  try {
    const lib = await pdfjs();
    // Copie défensive : pdfjs « détache » le buffer d'entrée. Sans copie, un 2ᵉ
    // usage du même Buffer (texte puis miniature) échoue (« detached ArrayBuffer »).
    const data = new Uint8Array(buf.byteLength);
    data.set(buf);
    return await lib.getDocument({
      data,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;
  } catch (e) {
    console.error("[engine/pdf] ouverture échouée :", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Texte intégré (couche texte) page par page. */
export async function extractPdfText(doc: PdfDoc): Promise<string> {
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str ?? "").join(" ") + "\n";
    } catch {
      /* page illisible → ignorée */
    }
  }
  return text.trim();
}

export type RenderOptions = { scale?: number; dpi?: number; maxDim?: number };

/**
 * Rend une page en PNG (pour OCR ou miniature). null si rendu indisponible.
 * - `scale` : facteur fixe (miniatures).
 * - `dpi`   : vise une résolution (OCR) ; l'échelle est calculée puis plafonnée
 *             par `maxDim` (px) pour borner la mémoire.
 */
export async function renderPdfPageToPng(
  doc: PdfDoc,
  pageNumber: number,
  opts: RenderOptions | number = {},
): Promise<Buffer | null> {
  try {
    const { createCanvas } = await canvasLib();
    const page = await doc.getPage(pageNumber);
    const o: RenderOptions = typeof opts === "number" ? { scale: opts } : opts;
    let scale = o.scale ?? 2;
    if (o.dpi) {
      const base = page.getViewport({ scale: 1 });
      scale = o.dpi / 72;
      const maxDim = o.maxDim ?? 3500;
      const longest = Math.max(base.width, base.height) * scale;
      if (longest > maxDim) scale *= maxDim / longest;
    }
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
    return canvas.toBuffer("image/png");
  } catch (e) {
    console.error("[engine/pdf] rendu page échoué :", e instanceof Error ? e.message : e);
    return null;
  }
}
