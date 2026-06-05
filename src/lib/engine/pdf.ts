import "server-only";

import fs from "node:fs";
import path from "node:path";

/* ────────────────────────────────────────────────────────────────────────
   Helpers PDF (pdfjs en Node + rendu raster via @napi-rs/canvas).
   Tout est best-effort : la moindre erreur renvoie null/[] sans casser
   l'ingestion (le document reste stocké, sans texte/miniature rendue).
   ──────────────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── Diagnostic bureau (Electron) ────────────────────────────────────────
   Logs détaillés UNIQUEMENT en app de bureau (process.versions.electron) ;
   jamais de bruit sur le serveur web. */
const IS_DESKTOP = Boolean((process as { versions?: { electron?: string } }).versions?.electron);
function dlog(...args: unknown[]) {
  if (IS_DESKTOP) console.log("[desktop/thumbnails]", ...args);
}

/* ── Codes d'erreur de rendu (remontés à GedifyErrorHint) ────────────────── */
export type PdfErrorCode =
  | "canvas_native_missing"
  | "pdf_worker_missing"
  | "pdf_standard_fonts_missing"
  | "pdf_render_failed";
let lastPdfError: PdfErrorCode | null = null;
function setPdfError(code: PdfErrorCode) {
  lastPdfError = code;
  dlog("error=" + code);
}
/** Récupère ET efface le dernier code d'erreur de rendu PDF (diagnostic vignette). */
export function takePdfRenderError(): PdfErrorCode | null {
  const c = lastPdfError;
  lastPdfError = null;
  return c;
}

/**
 * Résout un asset pdf.js (worker, standard_fonts…) en testant PLUSIEURS
 * emplacements — on ne dépend PAS uniquement de process.cwd() (cassé en app
 * packagée). `rel` = chemin sous `pdfjs-dist/`.
 */
function pdfjsCandidates(rel: string): string[] {
  const rp = (process as { resourcesPath?: string }).resourcesPath;
  const out: (string | null)[] = [
    path.join(process.cwd(), "node_modules", "pdfjs-dist", rel),
    rp ? path.join(rp, "gedify-runtime", "node_modules", "pdfjs-dist", rel) : null,
    rp ? path.join(rp, "app", "node_modules", "pdfjs-dist", rel) : null,
    rp ? path.join(rp, "app.asar.unpacked", "node_modules", "pdfjs-dist", rel) : null,
  ];
  // Relatif au fichier courant si disponible (dev / certaines arbos).
  try {
    if (typeof __dirname === "string") out.push(path.join(__dirname, "..", "..", "..", "node_modules", "pdfjs-dist", rel));
  } catch {
    /* __dirname indéfini en ESM pur → ignoré */
  }
  return out.filter((c): c is string => Boolean(c));
}
function firstExisting(paths: (string | null | undefined)[]): string | undefined {
  for (const p of paths) {
    if (!p) continue;
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}
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
    try {
      canvasMod = await import("@napi-rs/canvas");
    } catch (e) {
      setPdfError("canvas_native_missing");
      throw e instanceof Error ? e : new Error(String(e));
    }
    const g = globalThis as any;
    g.Path2D ??= canvasMod.Path2D;
    g.DOMMatrix ??= canvasMod.DOMMatrix;
    g.ImageData ??= canvasMod.ImageData;
    g.DOMPoint ??= canvasMod.DOMPoint;
    g.DOMRect ??= canvasMod.DOMRect;
  }
  return canvasMod;
}

/**
 * CanvasFactory pdf.js basée sur @napi-rs/canvas — INDISPENSABLE sous Electron.
 * Là `isNodeJS=false`, pdf.js choisit `DOMCanvasFactory` qui fait
 * `document.createElement('canvas')` ; `document` étant indéfini en Node, le
 * rendu plante (« Cannot read properties of undefined (reading 'createElement') »)
 * dès qu'un PDF contient une IMAGE (scans, logos, photos…) — les canvas
 * SECONDAIRES des XObjects image. On fournit une fabrique Node. Hors Electron
 * (web/serveur Node), pdf.js utilise SA NodeCanvasFactory → on n'override PAS.
 */
function makeNapiCanvasFactory(): any {
  const createCanvas = canvasMod?.createCanvas;
  if (!createCanvas) return undefined;
  return class NapiCanvasFactory {
    create(width: number, height: number) {
      const canvas = createCanvas(Math.max(1, width || 1), Math.max(1, height || 1));
      return { canvas, context: canvas.getContext("2d") };
    }
    reset(cc: any, width: number, height: number) {
      if (!cc?.canvas) throw new Error("CanvasFactory.reset : canvas absent");
      cc.canvas.width = Math.max(1, width || 1);
      cc.canvas.height = Math.max(1, height || 1);
    }
    destroy(cc: any) {
      if (cc?.canvas) {
        cc.canvas.width = 0;
        cc.canvas.height = 0;
      }
      if (cc) {
        cc.canvas = null;
        cc.context = null;
      }
    }
  };
}

/**
 * Dossier des POLICES STANDARD pdf.js (Helvetica/Times/… non embarquées).
 * SANS lui, en environnement sans polices système (conteneur Alpine), pdf.js
 * dessine les vecteurs (traits, fonds) mais PAS le texte (ou page blanche si le
 * PDF est uniquement textuel). Le dossier est embarqué dans l'image Docker
 * (node_modules/pdfjs-dist/standard_fonts).
 */
let standardFontDataUrl: string | undefined;
function resolveStandardFonts(): string | undefined {
  if (standardFontDataUrl !== undefined) return standardFontDataUrl || undefined;
  // Teste l'override PDFJS_STANDARD_FONTS PUIS tous les emplacements connus
  // (cwd, process.resourcesPath/…, app.asar.unpacked/…, relatif au fichier).
  const dirs = [process.env.PDFJS_STANDARD_FONTS?.trim() || null, ...pdfjsCandidates("standard_fonts")];
  const marker = firstExisting(dirs.map((d) => (d ? path.join(d, "FoxitDingbats.pfb") : null)));
  if (marker) {
    const dir = path.dirname(marker);
    standardFontDataUrl = dir.endsWith(path.sep) ? dir : dir + path.sep;
    dlog("standard_fonts=" + standardFontDataUrl);
    return standardFontDataUrl;
  }
  standardFontDataUrl = "";
  setPdfError("pdf_standard_fonts_missing");
  console.warn("[engine/pdf] standard_fonts pdf.js introuvable — le texte des PDF sans police embarquée ne sera pas rendu.");
  return undefined;
}

/**
 * Worker pdf.js (build legacy). UNIQUEMENT nécessaire sous Electron : là,
 * `process.type` vaut « utility » et pdf.js calcule `isNodeJS=false`
 * (`!(process.versions.electron && process.type && process.type!=='browser')`),
 * croit être dans un navigateur et EXIGE un workerSrc → sinon « No
 * GlobalWorkerOptions.workerSrc specified » et AUCUN rendu PDF (vignette = simple
 * placeholder). En pointant le worker legacy, pdf.js monte un « fake worker » sur
 * le thread principal et rend normalement. Hors Electron (web/serveur Node,
 * isNodeJS=true) on NE TOUCHE À RIEN → comportement web inchangé.
 */
function resolvePdfWorker(): string | undefined {
  return firstExisting([
    process.env.PDFJS_WORKER_SRC?.trim() || null,
    ...pdfjsCandidates("legacy/build/pdf.worker.mjs"),
  ]);
}

let pdfjsMod: any = null;
async function pdfjs(): Promise<any> {
  if (!pdfjsMod) {
    // Globals canvas posés AVANT l'import de pdfjs (ordre critique, cf. canvasLib).
    await canvasLib();
    // Build « legacy » = compatible Node (pas d'API navigateur requise).
    pdfjsMod = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // pdf.js exige un workerSrc dès qu'il ne se croit pas en « Node pur » — ce qui
    // est le cas sous Electron (utilityProcess : process.type='utility' →
    // isNodeJS=false) → sinon « No GlobalWorkerOptions.workerSrc specified » et
    // AUCUN rendu PDF. On fixe le worker legacy s'il n'est pas déjà défini : pdf.js
    // monte alors un « fake worker » sur le thread principal et rend. Sur le web
    // (Node), workerSrc est aussi vide par défaut mais pointe le MÊME worker legacy
    // que pdf.js auto-résout → strictement neutre.
    try {
      const gwo = pdfjsMod.GlobalWorkerOptions as { workerSrc?: string } | undefined;
      if (gwo && !gwo.workerSrc) {
        const w = resolvePdfWorker();
        if (w) {
          gwo.workerSrc = w;
          dlog("pdf.worker=" + w);
        } else {
          setPdfError("pdf_worker_missing");
          console.warn("[engine/pdf] worker pdf.js introuvable — rendu PDF en placeholder.");
        }
      }
    } catch (e) {
      console.error("[engine/pdf] configuration worker pdf.js :", e instanceof Error ? e.message : e);
    }
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
    const fonts = resolveStandardFonts();
    // Sous Electron, fournir notre CanvasFactory (sinon DOMCanvasFactory plante sur
    // les PDF avec images). Hors Electron : laissé à pdf.js (NodeCanvasFactory).
    const CanvasFactory = IS_DESKTOP ? makeNapiCanvasFactory() : undefined;
    return await lib.getDocument({
      data,
      isEvalSupported: false,
      // Pas de polices système (conteneur sans fontconfig) → on s'appuie sur les
      // polices embarquées du PDF + les polices standard pdf.js (standardFontDataUrl).
      useSystemFonts: false,
      disableFontFace: true,
      ...(fonts ? { standardFontDataUrl: fonts } : {}),
      ...(CanvasFactory ? { CanvasFactory } : {}),
    }).promise;
  } catch (e) {
    // Ne pas écraser un code plus précis déjà posé (worker/fonts/canvas).
    if (!lastPdfError) setPdfError("pdf_render_failed");
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
    dlog(`pdf render start page=${pageNumber} ${Math.ceil(viewport.width)}x${Math.ceil(viewport.height)}`);
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    // Fond blanc : pdfjs dessine sur un canvas transparent. Les PDF sans fond
    // explicite (scans, calques) ressortent alors avec des zones vides/noires
    // (« partiellement reconstitué »). On peint blanc avant le rendu.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
    const out = canvas.toBuffer("image/png");
    dlog(`pdf render ok size=${out.length}`);
    return out;
  } catch (e) {
    if (!lastPdfError) setPdfError("pdf_render_failed");
    console.error("[engine/pdf] rendu page échoué :", e instanceof Error ? e.message : e);
    return null;
  }
}
