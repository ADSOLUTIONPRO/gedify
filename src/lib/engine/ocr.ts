import "server-only";

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getDataDir } from "@/lib/storage/data-dir";
import { extractPdfText, loadPdf, renderPdfPageToPng, type PdfDoc } from "./pdf";

/* ────────────────────────────────────────────────────────────────────────
   Extraction de texte (remplace l'OCR de Paperless), poussée pour la qualité :
   1) Texte intégré (PDF natif, .txt…) — rapide, sans dépendance.
   2) OCR de secours (Tesseract.js fra+eng, 100 % hors-ligne) pour scans/images,
      avec PRÉ-TRAITEMENT sharp (gris, upscale, contraste, netteté), rendu PDF
      300 DPI, paramètres Tesseract optimisés et POOL de workers parallèles.
   Tout est best-effort : en cas d'échec, le document est stocké sans texte.
   ──────────────────────────────────────────────────────────────────────── */

export type ExtractResult = { text: string; pageCount: number | null };

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"];
const TEXT_EXT = [".txt", ".md", ".csv", ".log", ".json", ".xml", ".html", ".htm"];

const OCR_MAX_PAGES = Math.max(1, parseInt(process.env.OCR_MAX_PAGES ?? "30", 10) || 30);
const OCR_DPI = Math.max(150, parseInt(process.env.OCR_DPI ?? "300", 10) || 300);
const OCR_CONCURRENCY = Math.max(1, Math.min(4, parseInt(process.env.OCR_CONCURRENCY ?? "2", 10) || 2));

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
type Job = { png: Buffer; resolve: (s: string) => void; reject: (e: unknown) => void };

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
        job.resolve((data?.text ?? "").trim());
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
function recognize(png: Buffer): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    queue.push({ png, resolve, reject });
    void pump();
  });
}

async function ocrImage(buf: Buffer): Promise<string> {
  try {
    return await recognize(await preprocess(buf));
  } catch (e) {
    console.error("[engine/ocr] reconnaissance échouée :", e instanceof Error ? e.message : e);
    return "";
  }
}

/* ── OCR d'un PDF scanné : rendu 300 DPI + OCR parallèle ─────────────────── */
async function ocrPdf(doc: PdfDoc): Promise<string> {
  const max = Math.min(doc.numPages, OCR_MAX_PAGES);
  const jobs: Promise<string>[] = [];
  for (let i = 1; i <= max; i++) {
    const png = await renderPdfPageToPng(doc, i, { dpi: OCR_DPI, maxDim: 3500 });
    jobs.push(png ? ocrImage(png) : Promise.resolve(""));
  }
  const texts = await Promise.all(jobs);
  return texts.join("\n").trim();
}

async function extractPdf(buf: Buffer): Promise<ExtractResult> {
  const doc = await loadPdf(buf);
  if (!doc) return { text: "", pageCount: null };
  const pageCount = doc.numPages;
  let text = await extractPdfText(doc);
  // Couche texte absente/maigre (scan) → OCR de secours.
  const sparse = text.replace(/\s+/g, "").length < pageCount * 16;
  if (sparse) {
    const ocr = await ocrPdf(doc);
    if (ocr.length > text.length) text = ocr;
  }
  await doc.destroy?.().catch(() => {});
  return { text, pageCount };
}

export async function extractText(buf: Buffer, mime: string, ext: string): Promise<ExtractResult> {
  const lower = ext.toLowerCase();
  try {
    if (mime.startsWith("text/") || TEXT_EXT.includes(lower)) {
      return { text: safeUtf8(buf), pageCount: null };
    }
    if (mime === "application/pdf" || lower === ".pdf") {
      return await extractPdf(buf);
    }
    if (mime.startsWith("image/") || IMAGE_EXT.includes(lower)) {
      return { text: await ocrImage(buf), pageCount: 1 };
    }
  } catch (e) {
    console.error("[engine/ocr] extraction échouée :", e instanceof Error ? e.message : e);
  }
  // docx/xlsx/autres : pas d'extraction pur-JS en v1.
  return { text: "", pageCount: null };
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
