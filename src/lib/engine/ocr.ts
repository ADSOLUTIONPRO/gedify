import "server-only";

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getDataDir } from "@/lib/storage/data-dir";
import { extractPdfText, loadPdf, renderPdfPageToPng, type PdfDoc } from "./pdf";
import { extractOfficeText, isOfficeText } from "./office-text";

/* ────────────────────────────────────────────────────────────────────────
   Extraction de texte (remplace l'OCR de Paperless), poussée pour la qualité :
   1) Texte intégré (PDF natif, .txt…) — rapide, sans dépendance.
   2) OCR de secours (Tesseract.js fra+eng, 100 % hors-ligne) pour scans/images,
      avec PRÉ-TRAITEMENT sharp (gris, upscale, contraste, netteté), rendu PDF
      300 DPI, paramètres Tesseract optimisés et POOL de workers parallèles.
   Tout est best-effort : en cas d'échec, le document est stocké sans texte.
   ──────────────────────────────────────────────────────────────────────── */

export type OcrSource = "native_pdf_text" | "ocr_engine" | "text_file" | "unavailable";
export type ExtractResult = {
  text: string;
  pageCount: number | null;
  confidence: number | null;
  /** D'où vient le texte : texte natif du PDF, OCR Tesseract, fichier texte, ou indisponible. */
  source: OcrSource;
  /** OCR interrompu avant la fin (échéance document ou pages figées) → texte PARTIEL. */
  partial?: boolean;
  /** Pages réellement OCRisées avec succès. */
  pagesProcessed?: number;
  /** Pages tentées (min(numPages, OCR_MAX_PAGES)). */
  pagesTotal?: number;
};

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"];
const TEXT_EXT = [".txt", ".md", ".markdown", ".csv", ".tsv", ".log", ".json", ".xml", ".html", ".htm", ".yml", ".yaml"];

const OCR_MAX_PAGES = Math.max(1, parseInt(process.env.OCR_MAX_PAGES ?? "30", 10) || 30);
const OCR_DPI = Math.max(150, parseInt(process.env.OCR_DPI ?? "300", 10) || 300);
const OCR_CONCURRENCY = Math.max(1, Math.min(4, parseInt(process.env.OCR_CONCURRENCY ?? "2", 10) || 2));

/* Échéances OCR (configurables en SECONDES). Une page figée ne doit JAMAIS
   emporter tout le document : on borne CHAQUE page, et on s'arrête proprement à
   l'échéance globale en conservant le texte des pages déjà traitées (PARTIEL). */
function envSecs(key: string, def: number): number {
  const n = Number(process.env[key]);
  return (Number.isFinite(n) && n > 0 ? n : def) * 1000;
}
const OCR_PAGE_TIMEOUT_MS = envSecs("OCR_PAGE_TIMEOUT_SECONDS", 120);
const OCR_DOCUMENT_TIMEOUT_MS = envSecs("OCR_DOCUMENT_TIMEOUT_SECONDS", 900);

/** Borne une promesse de page : rejette `page_timeout` au dépassement (le travail
 *  Tesseract sous-jacent peut continuer en fond, la file n'est jamais bloquée). */
function withPageTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  if (!(ms > 0) || !Number.isFinite(ms)) return p;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("page_timeout")), ms);
    (t as { unref?: () => void }).unref?.();
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function safeUtf8(buf: Buffer): string {
  try {
    return buf.toString("utf8").replace(/\u0000/g, "").trim();
  } catch {
    return "";
  }
}

/* ── Pré-traitement image : maximise la lisibilité pour Tesseract ────────── */
async function preprocess(buf: Buffer): Promise<Buffer> {
  try {
    const base = sharp(buf, { failOn: "none" }).rotate(); // respecte l'orientation EXIF
    const meta = await base.metadata();
    const width = meta.width ?? 0;
    let pipe = base.grayscale().normalize(); // gris + étirement du contraste
    // Monte en résolution les petits scans (Tesseract aime ~300 DPI / texte large).
    if (width && width < 1800) {
      pipe = pipe.resize({ width: Math.min(3200, Math.round(width * 2)), kernel: "lanczos3" });
    }
    return await pipe.sharpen().png().toBuffer();
  } catch {
    return buf; // en cas d'échec, on OCR l'image brute
  }
}

/* ── Pool de workers Tesseract + file d'attente (sûr en concurrence) ─────── */
/* eslint-disable @typescript-eslint/no-explicit-any */
type OcrResult = { text: string; confidence: number | null };
type Job = { png: Buffer; resolve: (r: OcrResult) => void; reject: (e: unknown) => void };

let pool: any[] = [];
let poolInit: Promise<any[]> | null = null;
const busy = new Set<any>();
const queue: Job[] = [];

function resolveLangPath(): string | undefined {
  for (const dir of [process.env.TESSERACT_LANG_PATH, path.join(process.cwd(), "tessdata")]) {
    if (dir && fs.existsSync(path.join(dir, "eng.traineddata.gz"))) return dir;
  }
  return undefined;
}
function resolveCorePath(): string | undefined {
  for (const dir of [process.env.TESSERACT_CORE_PATH, path.join(process.cwd(), "node_modules", "tesseract.js-core")]) {
    if (dir && fs.existsSync(dir)) return dir;
  }
  return undefined;
}

async function getPool(): Promise<any[]> {
  if (pool.length) return pool;
  if (!poolInit) {
    poolInit = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const langPath = resolveLangPath();
      const corePath = resolveCorePath();
      const cachePath = path.join(getDataDir(), "tesseract-cache");
      try {
        fs.mkdirSync(cachePath, { recursive: true });
      } catch {
        /* cache best-effort */
      }
      const options: Record<string, unknown> = { cachePath };
      if (langPath) {
        options.langPath = langPath;
        options.gzip = true;
      }
      if (corePath) options.corePath = corePath;
      console.log(
        `[engine/ocr] Tesseract — langues: ${langPath ? "locales" : "CDN"}, coeur: ${corePath ? "local" : "CDN"}, ` +
          `workers: ${OCR_CONCURRENCY}, DPI: ${OCR_DPI}.`,
      );
      const workers: any[] = [];
      for (let i = 0; i < OCR_CONCURRENCY; i++) {
        const w = await createWorker("fra+eng", 1, options); // OEM 1 = LSTM
        await w.setParameters({
          tessedit_pageseg_mode: PSM.AUTO, // segmentation automatique de page
          preserve_interword_spaces: "1",
          user_defined_dpi: String(OCR_DPI),
        });
        workers.push(w);
      }
      pool = workers;
      return pool;
    })();
  }
  return poolInit;
}

async function drain(worker: any): Promise<void> {
  if (busy.has(worker)) return;
  busy.add(worker);
  try {
    while (queue.length) {
      const job = queue.shift()!;
      try {
        const { data } = await worker.recognize(job.png);
        job.resolve({
          text: (data?.text ?? "").trim(),
          confidence: typeof data?.confidence === "number" ? data.confidence : null,
        });
      } catch (e) {
        job.reject(e);
      }
    }
  } finally {
    busy.delete(worker);
  }
}

async function pump(): Promise<void> {
  const workers = await getPool();
  for (const w of workers) void drain(w);
}

/** OCR d'une image déjà pré-traitée (PNG), via le pool. */
function recognize(png: Buffer): Promise<OcrResult> {
  return new Promise<OcrResult>((resolve, reject) => {
    queue.push({ png, resolve, reject });
    void pump();
  });
}

async function ocrImage(buf: Buffer): Promise<OcrResult> {
  try {
    return await recognize(await preprocess(buf));
  } catch (e) {
    console.error("[engine/ocr] reconnaissance échouée :", e instanceof Error ? e.message : e);
    return { text: "", confidence: null };
  }
}

function avgConfidence(results: OcrResult[]): number | null {
  const vals = results.map((r) => r.confidence).filter((c): c is number => typeof c === "number");
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

type OcrPdfResult = OcrResult & { partial: boolean; pagesProcessed: number; pagesTotal: number };

/* ── OCR d'un PDF scanné : rendu 300 DPI, PAGE PAR PAGE ──────────────────────
   Chaque page est bornée par OCR_PAGE_TIMEOUT (une page corrompue/figée est
   IGNORÉE, pas fatale) et l'ensemble par une ÉCHÉANCE document : au-delà, on
   renvoie le texte des pages déjà OCRisées (résultat PARTIEL, jamais perdu).
   Fini le « tout-ou-rien » du Promise.all global qui jetait tout au 1ᵉ timeout. */
async function ocrPdf(doc: PdfDoc, deadline: number): Promise<OcrPdfResult> {
  const total = Math.min(doc.numPages, OCR_MAX_PAGES);
  const results: OcrResult[] = [];
  let processed = 0;
  let partial = false;

  for (let i = 1; i <= total; i++) {
    // Budget restant avant l'échéance globale du document.
    const remaining = deadline - Date.now();
    if (remaining <= 0) { partial = true; break; }
    const pageBudget = Math.min(OCR_PAGE_TIMEOUT_MS, remaining);
    try {
      const png = await withPageTimeout(renderPdfPageToPng(doc, i, { dpi: OCR_DPI, maxDim: 3500 }), pageBudget);
      if (!png) continue; // page non rendue → ignorée, on continue
      const r = await withPageTimeout(ocrImage(png), Math.min(OCR_PAGE_TIMEOUT_MS, Math.max(1, deadline - Date.now())));
      results.push(r);
      if (r.text.trim()) processed += 1;
    } catch (e) {
      // page figée / rendu en échec → ignorée ; le document continue.
      partial = true;
      console.warn(`[engine/ocr] page ${i}/${total} ignorée : ${e instanceof Error ? e.message : e}`);
    }
  }

  return {
    text: results.map((r) => r.text).join("\n").trim(),
    confidence: avgConfidence(results),
    partial,
    pagesProcessed: processed,
    pagesTotal: total,
  };
}

async function extractPdf(buf: Buffer, deadline: number): Promise<ExtractResult> {
  const doc = await loadPdf(buf);
  if (!doc) return { text: "", pageCount: null, confidence: null, source: "unavailable" };
  const pageCount = doc.numPages;
  // 1) Détection du TEXTE NATIF d'abord (rapide, sans OCR) : un PDF déjà
  //    « textuel » n'est jamais OCRisé inutilement.
  let text = await extractPdfText(doc);
  let confidence: number | null = null;
  let source: OcrSource = text.replace(/\s+/g, "").length > 0 ? "native_pdf_text" : "unavailable";
  let partial = false;
  let pagesProcessed: number | undefined;
  let pagesTotal: number | undefined;
  // 2) Couche texte absente/maigre (scan) → OCR de secours page par page.
  const sparse = text.replace(/\s+/g, "").length < pageCount * 16;
  if (sparse) {
    const ocr = await ocrPdf(doc, deadline);
    if (ocr.text.length > text.length) {
      text = ocr.text;
      confidence = ocr.confidence;
      source = "ocr_engine";
    }
    partial = ocr.partial;
    pagesProcessed = ocr.pagesProcessed;
    pagesTotal = ocr.pagesTotal;
  }
  await doc.destroy?.().catch(() => {});
  return { text, pageCount, confidence, source, partial, pagesProcessed, pagesTotal };
}

export async function extractText(buf: Buffer, mime: string, ext: string): Promise<ExtractResult> {
  const lower = ext.toLowerCase();
  // Échéance globale de l'extraction du document : au-delà, on renvoie ce qui a
  // pu être OCRisé (résultat partiel) plutôt que de tout perdre.
  const deadline = Date.now() + OCR_DOCUMENT_TIMEOUT_MS;
  try {
    if (mime.startsWith("text/") || TEXT_EXT.includes(lower)) {
      return { text: safeUtf8(buf), pageCount: null, confidence: null, source: "text_file" };
    }
    if (mime === "application/pdf" || lower === ".pdf") {
      return await extractPdf(buf, deadline);
    }
    if (mime.startsWith("image/") || IMAGE_EXT.includes(lower)) {
      // Image unique : bornée par le timeout page (≤ échéance document).
      const budget = Math.min(OCR_PAGE_TIMEOUT_MS, Math.max(1, deadline - Date.now()));
      try {
        const r = await withPageTimeout(ocrImage(buf), budget);
        return { text: r.text, pageCount: 1, confidence: r.confidence, source: "ocr_engine", pagesProcessed: r.text.trim() ? 1 : 0, pagesTotal: 1 };
      } catch (e) {
        console.warn("[engine/ocr] OCR image expiré :", e instanceof Error ? e.message : e);
        return { text: "", pageCount: 1, confidence: null, source: "ocr_engine", partial: true, pagesProcessed: 0, pagesTotal: 1 };
      }
    }
    // Documents bureautiques (Word / tableurs) → texte intégré, lisible & indexable.
    if (isOfficeText(lower)) {
      const text = await extractOfficeText(buf, lower);
      return { text, pageCount: null, confidence: null, source: text ? "text_file" : "unavailable" };
    }
  } catch (e) {
    console.error("[engine/ocr] extraction échouée :", e instanceof Error ? e.message : e);
  }
  // .doc (Word binaire ancien), .pptx et autres : stockés sans couche texte en v1.
  return { text: "", pageCount: null, confidence: null, source: "unavailable" };
}

/** Libère les workers Tesseract (optionnel, ex. arrêt propre). */
export async function terminateOcr(): Promise<void> {
  const workers = pool;
  pool = [];
  poolInit = null;
  busy.clear();
  for (const w of workers) {
    try {
      await w?.terminate?.();
    } catch {
      /* ignore */
    }
  }
}
