"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CalendarDays, Check, Copy, Download, Image as ImageIcon, Layers, Loader2, Mail,
  MapPin, Maximize2, MousePointerClick, PenLine, Plus, Stamp, Type, X, ZoomIn, ZoomOut,
} from "lucide-react";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import { SignaturePad } from "@/components/documents/signature-pad";

type FieldType = "signature" | "paraphe" | "date" | "lieu" | "photo" | "text";

/** Élément apposé sur le PDF (coordonnées normalisées 0–1, origine haut-gauche). */
type Field = {
  id: string;
  type: FieldType;
  page: number; // 1-based
  x: number; y: number; w: number; h: number;
  dataUrl?: string; // images (signature/paraphe/photo/date|lieu manuscrits)
  text?: string; // date/lieu/text en mode texte
  source: string; // "draw" | "import" | "text" | "saved" | "photo"
  label: string; // libellé lisible
};

/** Élément « préparé » dans une section (aperçu réutilisable avant placement). */
type Asset = { dataUrl?: string; text?: string };

/** Placement armé qui suit le curseur jusqu'au clic sur une page (façon Acrobat). */
type Pending = { type: FieldType; dataUrl?: string; text?: string; w: number; h: number; source: string; label: string };

type Saved = { id: string; kind: "signature" | "paraphe"; name: string; dataUrl: string };
type PageSize = { w: number; h: number };
type SignResult = { signedDocumentId: number | null; signedTitle: string; pending?: boolean };

const DEFAULT_SIZE: Record<FieldType, { w: number; h: number }> = {
  signature: { w: 0.24, h: 0.08 },
  paraphe: { w: 0.1, h: 0.05 },
  date: { w: 0.22, h: 0.034 },
  lieu: { w: 0.28, h: 0.034 },
  text: { w: 0.28, h: 0.04 },
  photo: { w: 0.28, h: 0.2 },
};

const LABELS: Record<FieldType, string> = {
  signature: "Signature", paraphe: "Paraphe", date: "Date du jour", lieu: "Lieu", text: "Texte libre", photo: "Photo",
};

const LIEU_KEY = "ged.signature.lieu";

function todayFr(): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}
function uid(): string { return Math.random().toString(36).slice(2, 10); }
function clamp(v: number, a: number, b: number): number { return Math.max(a, Math.min(b, v)); }
function isJpeg(dataUrl: string): boolean { return /^data:image\/jpe?g/i.test(dataUrl); }

/** Convertit un fichier image en PNG (embarquable par pdf-lib, alpha conservé). */
function fileToPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d");
        if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("image"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

export function DocumentSignEditor({ documentId, title }: { documentId: number; title: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const [fields, setFields] = useState<Field[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);

  // Assets préparés par section (aperçus réutilisables).
  const [sigAsset, setSigAsset] = useState<Asset | null>(null);
  const [paraAsset, setParaAsset] = useState<Asset | null>(null);
  const [dateImg, setDateImg] = useState<string | null>(null);
  const [lieuImg, setLieuImg] = useState<string | null>(null);
  const [dateText, setDateText] = useState(todayFr());
  const [lieuCity, setLieuCity] = useState("");
  const [textValue, setTextValue] = useState("Bon pour accord");
  const [padOpen, setPadOpen] = useState<FieldType | null>(null);

  // Placement armé (suit le curseur).
  const [pending, setPending] = useState<Pending | null>(null);

  const [showSummary, setShowSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<SignResult | null>(null);
  const [showPagesMobile, setShowPagesMobile] = useState(false);
  const [showToolsMobile, setShowToolsMobile] = useState(false);

  const bytesRef = useRef<Uint8Array | null>(null);
  const pdfRef = useRef<unknown>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const thumbRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pageWrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mainRef = useRef<HTMLElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const ratios = useRef<Map<number, number>>(new Map());

  // ── Chargement PDF + signatures enregistrées ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/paperless/documents/${documentId}/download`, { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        bytesRef.current = buf;
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setLoadError(e instanceof Error ? e.message : "Erreur de chargement du PDF."); setLoading(false); }
      }
    })();
    void fetch("/api/documents/signatures", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { signatures: [] }))
      .then((d: { signatures?: Saved[] }) => { if (!cancelled) setSaved(d.signatures ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [documentId]);

  useEffect(() => {
    void Promise.resolve().then(() => setLieuCity(localStorage.getItem(LIEU_KEY) ?? ""));
  }, []);

  // ── Rendu des pages (re-rendu au zoom) ──
  const renderPages = useCallback(async () => {
    const pdf = pdfRef.current as { getPage: (n: number) => Promise<unknown> } | null;
    if (!pdf || numPages === 0) return;
    const container = mainRef.current;
    const containerWidth = container ? container.clientWidth - 48 : 800;
    const sizes: PageSize[] = [];
    for (let i = 1; i <= numPages; i++) {
      const page = (await pdf.getPage(i)) as {
        getViewport: (o: { scale: number }) => { width: number; height: number };
        render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
      };
      const base = page.getViewport({ scale: 1 });
      const fit = Math.min(1.8, Math.max(0.4, (containerWidth / base.width)));
      const scale = fit * zoom;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRefs.current[i - 1];
      sizes[i - 1] = { w: viewport.width, h: viewport.height };
      if (canvas) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
      }
    }
    setPageSizes(sizes);
  }, [numPages, zoom]);

  useEffect(() => { if (!loading && !loadError && numPages > 0) void renderPages(); }, [loading, loadError, numPages, zoom, renderPages]);

  // ── Miniatures ──
  useEffect(() => {
    if (loading || loadError || numPages === 0) return;
    const pdf = pdfRef.current as { getPage: (n: number) => Promise<unknown> } | null;
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      for (let i = 1; i <= numPages; i++) {
        if (cancelled) return;
        const page = (await pdf.getPage(i)) as { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } };
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 130 / base.width });
        const c = thumbRefs.current[i - 1];
        if (c) { c.width = viewport.width; c.height = viewport.height; const ctx = c.getContext("2d"); if (ctx) await page.render({ canvasContext: ctx, viewport }).promise; }
      }
    })();
    return () => { cancelled = true; };
  }, [loading, loadError, numPages]);

  // ── Page active selon le scroll (IntersectionObserver) ──
  useEffect(() => {
    if (loading || loadError || numPages === 0 || pageSizes.length === 0) return;
    const root = mainRef.current;
    if (!root) return;
    const obs = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const p = Number((en.target as HTMLElement).dataset.page);
        if (p) ratios.current.set(p, en.isIntersecting ? en.intersectionRatio : 0);
      }
      let best = 1, bestR = -1;
      ratios.current.forEach((r, p) => { if (r > bestR) { bestR = r; best = p; } });
      setCurrentPage(best);
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    pageWrapRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [loading, loadError, numPages, pageSizes.length]);

  // ── Le ghost de placement suit le curseur ; Échap annule ──
  useEffect(() => {
    if (!pending) return;
    function onMove(e: PointerEvent) {
      const g = ghostRef.current;
      if (g) { g.style.left = `${e.clientX}px`; g.style.top = `${e.clientY}px`; g.style.opacity = "1"; }
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setPending(null); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("keydown", onKey); };
  }, [pending]);

  // ── Armement du placement (façon Acrobat : l'élément se colle au curseur) ──
  function arm(p: { type: FieldType; dataUrl?: string; text?: string; w?: number; h?: number; source: string }) {
    const size = DEFAULT_SIZE[p.type];
    setPending({ type: p.type, dataUrl: p.dataUrl, text: p.text, w: p.w ?? size.w, h: p.h ?? size.h, source: p.source, label: LABELS[p.type] });
    setShowToolsMobile(false);
  }

  // ── Apposer sur la page cliquée (centré sur le curseur) ──
  function placeAt(pageIndex: number, e: React.MouseEvent) {
    if (!pending) return;
    const wrap = pageWrapRefs.current[pageIndex];
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const x = clamp(nx - pending.w / 2, 0, 1 - pending.w);
    const y = clamp(ny - pending.h / 2, 0, 1 - pending.h);
    const f: Field = { id: uid(), type: pending.type, page: pageIndex + 1, x, y, w: pending.w, h: pending.h, dataUrl: pending.dataUrl, text: pending.text, source: pending.source, label: pending.label };
    setFields((p) => [...p, f]);
    setSelectedId(f.id);
    setPending(null);
  }

  function updateField(id: string, patch: Partial<Field>) { setFields((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f))); }
  function removeField(id: string) { setFields((p) => p.filter((f) => f.id !== id)); if (selectedId === id) setSelectedId(null); }
  function duplicateField(id: string) {
    setFields((p) => {
      const src = p.find((f) => f.id === id);
      if (!src) return p;
      const copy: Field = { ...src, id: uid(), x: clamp(src.x + 0.03, 0, 1 - src.w), y: clamp(src.y + 0.03, 0, 1 - src.h) };
      return [...p, copy];
    });
  }

  // Parapher toutes les pages (bas-droite) à partir d'un asset paraphe.
  function paraTapheAll(dataUrl: string) {
    const size = DEFAULT_SIZE.paraphe;
    setFields((p) => [
      ...p,
      ...Array.from({ length: numPages }, (_, i) => ({ id: uid(), type: "paraphe" as FieldType, page: i + 1, x: 1 - size.w - 0.04, y: 1 - size.h - 0.04, w: size.w, h: size.h, dataUrl, source: "saved", label: LABELS.paraphe })),
    ]);
    setPending(null);
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxW = 1000;
        const ratio = Math.min(1, maxW / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        arm({ type: "photo", dataUrl: c.toDataURL("image/jpeg", 0.8), w: 0.28, h: 0.28 * (c.height / c.width), source: "photo" });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Drag / resize d'un champ (au sein de sa page, stable au zoom) ──
  function onFieldPointerDown(e: React.PointerEvent<HTMLElement>, field: Field, mode: "move" | "resize") {
    e.preventDefault(); e.stopPropagation();
    setSelectedId(field.id);
    const wrap = pageWrapRefs.current[field.page - 1];
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, x: field.x, y: field.y, w: field.w, h: field.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - start.px) / rect.width;
      const dy = (ev.clientY - start.py) / rect.height;
      if (mode === "move") updateField(field.id, { x: clamp(start.x + dx, 0, 1 - field.w), y: clamp(start.y + dy, 0, 1 - field.h) });
      else updateField(field.id, { w: clamp(start.w + dx, 0.04, 1 - field.x), h: clamp(start.h + dy, 0.02, 1 - field.y) });
    }
    function onUp() { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // ── Résumé ──
  const summary = useMemo(() => {
    const paraPages = new Set(fields.filter((f) => f.type === "paraphe").map((f) => f.page));
    const lieuField = fields.find((f) => f.type === "lieu");
    return {
      pages: numPages,
      paraphedPages: paraPages.size,
      signatures: fields.filter((f) => f.type === "signature").length,
      paraphes: fields.filter((f) => f.type === "paraphe").length,
      hasDate: fields.some((f) => f.type === "date"),
      lieu: lieuField?.text?.replace(/^Fait à\s*/i, "") ?? (lieuField?.dataUrl ? "(image)" : ""),
      photos: fields.filter((f) => f.type === "photo").length,
    };
  }, [fields, numPages]);

  // ── Génération + enregistrement ──
  async function doSave() {
    if (!bytesRef.current || saving) return;
    setSaving(true); setSaveError(null);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.load(bytesRef.current);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      for (const f of fields) {
        const page = pages[f.page - 1];
        if (!page) continue;
        const { width: pw, height: ph } = page.getSize();
        const x = f.x * pw, wPts = f.w * pw, hPts = f.h * ph;
        const y = ph - f.y * ph - hPts;
        if (f.dataUrl) {
          const img = isJpeg(f.dataUrl) ? await pdfDoc.embedJpg(f.dataUrl) : await pdfDoc.embedPng(f.dataUrl);
          page.drawImage(img, { x, y, width: wPts, height: hPts });
        } else if (f.text) {
          const fontSize = Math.max(8, hPts * 0.72);
          page.drawText(f.text, { x, y: y + (hPts - fontSize) / 2, size: fontSize, font, color: rgb(0.06, 0.09, 0.16) });
        }
      }
      const out = await pdfDoc.save();
      const form = new FormData();
      form.append("document", new Blob([new Uint8Array(out)], { type: "application/pdf" }), "signed.pdf");
      form.append("method", "draw");
      form.append("page", String(fields.find((f) => f.type === "signature")?.page ?? 1));
      form.append("pages", String(summary.pages));
      form.append("paraphes", String(summary.paraphes));
      form.append("signatures", String(summary.signatures));
      form.append("hasDate", String(summary.hasDate));
      form.append("lieu", summary.lieu);
      form.append("photos", String(summary.photos));

      const res = await fetch(`/api/documents/${documentId}/sign`, { method: "POST", credentials: "include", body: form });
      const data = (await res.json().catch(() => ({}))) as SignResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible.");
      setShowSummary(false);
      setResult({ signedDocumentId: data.signedDocumentId, signedTitle: data.signedTitle, pending: data.pending });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erreur lors de la signature.");
    } finally {
      setSaving(false);
    }
  }

  const signatures = saved.filter((s) => s.kind === "signature");
  const paraphes = saved.filter((s) => s.kind === "paraphe");

  // ── Contenu de la sidebar outils (réutilisé desktop + mobile) ──
  const toolsContent = (
    <div className="space-y-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>
        Outils — page {currentPage}/{numPages || "…"}
      </p>

      {/* Signature */}
      <ToolSection icon={PenLine} title="Signature">
        <SavedPicker items={signatures} selected={sigAsset?.dataUrl} onPick={(d) => { setSigAsset({ dataUrl: d }); setPadOpen(null); }} emptyLabel="Aucune signature enregistrée" />
        <AssetPreview asset={sigAsset} onUse={() => sigAsset?.dataUrl && arm({ type: "signature", dataUrl: sigAsset.dataUrl, source: "saved" })} onClear={() => setSigAsset(null)} />
        <PadToggle open={padOpen === "signature"} onToggle={() => setPadOpen(padOpen === "signature" ? null : "signature")} onGenerate={(d) => { setSigAsset({ dataUrl: d }); setPadOpen(null); }} cta="Préparer la signature" />
      </ToolSection>

      {/* Paraphe */}
      <ToolSection icon={Stamp} title="Paraphe">
        <SavedPicker items={paraphes} selected={paraAsset?.dataUrl} onPick={(d) => { setParaAsset({ dataUrl: d }); setPadOpen(null); }} emptyLabel="Aucun paraphe enregistré" />
        <AssetPreview asset={paraAsset} onUse={() => paraAsset?.dataUrl && arm({ type: "paraphe", dataUrl: paraAsset.dataUrl, source: "saved" })} onClear={() => setParaAsset(null)}
          extra={paraAsset?.dataUrl ? { label: "Parapher toutes les pages", onClick: () => paraAsset.dataUrl && paraTapheAll(paraAsset.dataUrl) } : undefined} />
        <PadToggle open={padOpen === "paraphe"} onToggle={() => setPadOpen(padOpen === "paraphe" ? null : "paraphe")} onGenerate={(d) => { setParaAsset({ dataUrl: d }); setPadOpen(null); }} cta="Préparer le paraphe" />
      </ToolSection>

      {/* Date du jour */}
      <ToolSection icon={CalendarDays} title="Date du jour">
        <div className="flex gap-1.5">
          <input type="text" value={dateText} onChange={(e) => setDateText(e.target.value)} placeholder="02/06/2026" className={smallInput} style={{ borderColor: "var(--border)" }} />
          <button type="button" onClick={() => arm({ type: "date", text: dateText.trim() || todayFr(), source: "text" })} className={useBtn} style={{ background: "var(--accent)" }}>Utiliser</button>
        </div>
        {dateImg ? <AssetPreview asset={{ dataUrl: dateImg }} onUse={() => arm({ type: "date", dataUrl: dateImg, source: "import" })} onClear={() => setDateImg(null)} /> : null}
        <PadToggle open={padOpen === "date"} onToggle={() => setPadOpen(padOpen === "date" ? null : "date")} onGenerate={(d) => { setDateImg(d); setPadOpen(null); }} cta="Préparer (manuscrit / image)" defaultText={dateText} />
      </ToolSection>

      {/* Lieu */}
      <ToolSection icon={MapPin} title="Lieu de signature">
        <div className="flex gap-1.5">
          <input type="text" value={lieuCity} onChange={(e) => setLieuCity(e.target.value)} placeholder="Ville (ex. Nancy)" className={smallInput} style={{ borderColor: "var(--border)" }} />
          <button type="button" onClick={() => { const c = lieuCity.trim(); if (c) localStorage.setItem(LIEU_KEY, c); arm({ type: "lieu", text: `Fait à ${c || "…"}`, source: "text" }); }} className={useBtn} style={{ background: "var(--accent)" }}>Utiliser</button>
        </div>
        {lieuImg ? <AssetPreview asset={{ dataUrl: lieuImg }} onUse={() => arm({ type: "lieu", dataUrl: lieuImg, source: "import" })} onClear={() => setLieuImg(null)} /> : null}
        <PadToggle open={padOpen === "lieu"} onToggle={() => setPadOpen(padOpen === "lieu" ? null : "lieu")} onGenerate={(d) => { setLieuImg(d); setPadOpen(null); }} cta="Préparer (manuscrit / image)" defaultText={lieuCity ? `Fait à ${lieuCity}` : ""} />
      </ToolSection>

      {/* Texte libre */}
      <ToolSection icon={Type} title="Texte libre">
        <div className="flex gap-1.5">
          <input type="text" value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Bon pour accord…" className={smallInput} style={{ borderColor: "var(--border)" }} />
          <button type="button" onClick={() => textValue.trim() && arm({ type: "text", text: textValue.trim(), source: "text" })} className={useBtn} style={{ background: "var(--accent)" }}>Utiliser</button>
        </div>
      </ToolSection>

      {/* Photo / image */}
      <ToolSection icon={ImageIcon} title="Photo / image">
        <label className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[12.5px] font-bold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <ImageIcon className="h-4 w-4" strokeWidth={1.85} /> Importer une image (compressée)
          <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
        </label>
      </ToolSection>
    </div>
  );

  if (result) return <ResultView documentId={documentId} result={result} />;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#FCFAF7]">
      {/* En-tête */}
      <header className="flex items-center gap-3 border-b bg-white px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
        <Link href={`/documents/${documentId}`} aria-label="Retour" className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.85} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-hint)" }}>Signer le document</p>
          <h1 className="truncate text-[14px] font-extrabold" style={{ color: "var(--text-main)" }} title={title}>{title}</h1>
        </div>
        <button type="button" onClick={() => setShowPagesMobile(true)} className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-bold lg:hidden" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <Layers className="h-4 w-4" strokeWidth={1.85} /> Pages
        </button>
        <button type="button" onClick={() => setShowToolsMobile(true)} className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-bold lg:hidden" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <PenLine className="h-4 w-4" strokeWidth={1.85} /> Outils
        </button>
        <button type="button" onClick={() => setShowSummary(true)} disabled={fields.length === 0} className="inline-flex h-9 items-center gap-1.5 rounded-[20px] px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
          <Check className="h-4 w-4" strokeWidth={2.25} /> <span className="hidden sm:inline">Enregistrer la signature</span><span className="sm:hidden">Signer</span>
        </button>
      </header>

      {/* Bandeau de placement armé */}
      {pending ? (
        <div className="flex items-center justify-center gap-2 border-b px-4 py-1.5 text-[12px] font-semibold" style={{ borderColor: "var(--border)", background: "var(--accent-soft)", color: "var(--accent)" }}>
          <MousePointerClick className="h-4 w-4" strokeWidth={2} /> Cliquez dans la page pour apposer « {pending.label} » — <kbd className="rounded border px-1">Échap</kbd> pour annuler
          <button type="button" onClick={() => setPending(null)} className="ml-1 underline">Annuler</button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Miniatures (gauche) */}
        <aside className="hidden w-44 shrink-0 overflow-y-auto border-r bg-white p-2 lg:block" style={{ borderColor: "var(--border)" }}>
          <ThumbList numPages={numPages} thumbRefs={thumbRefs} fields={fields} currentPage={currentPage} onPick={(n) => { setCurrentPage(n); pageWrapRefs.current[n - 1]?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
        </aside>

        {/* Aperçu PDF (centre) */}
        <main ref={mainRef} className="relative min-w-0 flex-1 overflow-y-auto">
          {/* Barre zoom */}
          <div className="sticky top-0 z-10 flex items-center justify-center gap-2 border-b bg-white/90 px-3 py-1.5 backdrop-blur" style={{ borderColor: "var(--border)" }}>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)" }} aria-label="Zoom -"><ZoomOut className="h-4 w-4" /></button>
            <span className="w-12 text-center text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)" }} aria-label="Zoom +"><ZoomIn className="h-4 w-4" /></button>
            <button type="button" onClick={() => setZoom(1)} className="flex h-8 items-center gap-1 rounded-lg border px-2 text-[12px] font-semibold hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)" }}><Maximize2 className="h-3.5 w-3.5" /> Ajuster</button>
          </div>

          {loading ? (
            <div className="flex h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} /></div>
          ) : loadError ? (
            <p className="p-8 text-center text-[13px] font-semibold" style={{ color: "var(--danger)" }}>{loadError}</p>
          ) : (
            <div className="flex flex-col items-center gap-6 p-4 pb-24">
              {Array.from({ length: numPages }, (_, i) => {
                const size = pageSizes[i];
                return (
                  <div
                    key={i}
                    data-page={i + 1}
                    ref={(el) => { pageWrapRefs.current[i] = el; }}
                    className="relative shadow-md transition"
                    style={{ width: size?.w, height: size?.h, background: "#fff", cursor: pending ? "crosshair" : "default", outline: currentPage === i + 1 ? "2px solid var(--accent)" : "none", outlineOffset: "2px" }}
                    onClick={(e) => { if (pending) placeAt(i, e); else setSelectedId(null); }}
                  >
                    <canvas ref={(el) => { canvasRefs.current[i] = el; }} className="block" />
                    {fields.filter((f) => f.page === i + 1).map((f) => (
                      <FieldBox key={f.id} field={f} selected={selectedId === f.id}
                        onPointerDownMove={(e) => onFieldPointerDown(e, f, "move")}
                        onPointerDownResize={(e) => onFieldPointerDown(e, f, "resize")}
                        onRemove={() => removeField(f.id)} onDuplicate={() => duplicateField(f.id)}
                        onSelect={() => setSelectedId(f.id)} onText={(t) => updateField(f.id, { text: t })}
                        onReplace={(d) => updateField(f.id, { dataUrl: d, source: "import" })} />
                    ))}
                    <span className="pointer-events-none absolute -top-4 left-0 text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>Page {i + 1}</span>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Outils (droite) */}
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l bg-white p-3 lg:block" style={{ borderColor: "var(--border)" }}>
          {toolsContent}
        </aside>
      </div>

      {/* Outils mobile (bottom sheet) */}
      {showToolsMobile ? (
        <div className="fixed inset-0 z-[95] lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => setShowToolsMobile(false)} className="absolute inset-0 bg-slate-900/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "var(--border)" }} />
            {toolsContent}
          </div>
        </div>
      ) : null}

      {/* Miniatures mobile */}
      {showPagesMobile ? (
        <div className="fixed inset-0 z-[95] lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => setShowPagesMobile(false)} className="absolute inset-0 bg-slate-900/40" />
          <div className="absolute inset-y-0 left-0 w-48 overflow-y-auto bg-white p-2 shadow-2xl">
            <ThumbList numPages={numPages} thumbRefs={thumbRefs} fields={fields} currentPage={currentPage} onPick={(n) => { setCurrentPage(n); setShowPagesMobile(false); pageWrapRefs.current[n - 1]?.scrollIntoView({ behavior: "smooth" }); }} />
          </div>
        </div>
      ) : null}

      <p className="border-t bg-white px-4 py-1.5 text-center text-[10.5px]" style={{ borderColor: "var(--border)", color: "var(--text-hint)" }}>
        Signature visuelle ajoutée au document. Pour une signature électronique certifiée eIDAS, une intégration dédiée sera nécessaire.
      </p>

      {/* Ghost de placement (suit le curseur) */}
      {pending ? (
        <div ref={ghostRef} className="pointer-events-none fixed z-[120] -translate-x-1/2 -translate-y-1/2 opacity-0" style={{ left: "50%", top: "50%" }}>
          {pending.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pending.dataUrl} alt="" className="max-h-24 max-w-[200px] rounded" style={{ boxShadow: "0 8px 24px rgba(0,0,0,.22), 0 0 0 2px var(--accent)" }} />
          ) : (
            <span className="rounded-md px-2 py-1 text-[13px] font-bold" style={{ background: "#fff", color: "#0F172A", boxShadow: "0 8px 24px rgba(0,0,0,.22), 0 0 0 2px var(--accent)" }}>{pending.text}</span>
          )}
        </div>
      ) : null}

      {/* Résumé avant enregistrement */}
      {showSummary ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => setShowSummary(false)} className="absolute inset-0 bg-slate-900/45" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>Résumé de signature</h2>
            <ul className="mt-3 space-y-1 text-[13px]" style={{ color: "var(--text-main)" }}>
              <li>Pages : {summary.pages}</li>
              <li>Pages paraphées : {summary.paraphedPages} / {summary.pages}</li>
              <li>Signature(s) : {summary.signatures}</li>
              <li>Date : {summary.hasDate ? "oui" : "non"}</li>
              <li>Lieu : {summary.lieu || "—"}</li>
              <li>Photos : {summary.photos}</li>
            </ul>
            {summary.paraphedPages < summary.pages ? (
              <p className="mt-3 rounded-lg px-3 py-2 text-[12px] font-semibold" style={{ background: "#FFF4E5", color: "#B45309" }}>Attention : certaines pages ne sont pas paraphées.</p>
            ) : null}
            {saveError ? <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--danger)" }}>{saveError}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setShowSummary(false)} className="h-10 rounded-full border px-4 text-[13px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Annuler</button>
              {summary.paraphedPages < summary.pages && paraAsset?.dataUrl ? (
                <button type="button" onClick={() => paraAsset.dataUrl && paraTapheAll(paraAsset.dataUrl)} className="h-10 rounded-full border px-4 text-[13px] font-bold" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>Parapher toutes les pages</button>
              ) : null}
              <button type="button" onClick={() => void doSave()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continuer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Styles réutilisés ──
const smallInput = "h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-[12.5px] outline-none focus:border-[var(--accent)]";
const useBtn = "inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-[12px] font-bold text-white transition hover:opacity-90";

// ── Sous-composants ──

function ToolSection({ icon: Icon, title, children }: { icon: typeof PenLine; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>
        <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} strokeWidth={1.9} /> {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function SavedPicker({ items, selected, onPick, emptyLabel }: { items: Saved[]; selected?: string; onPick: (dataUrl: string) => void; emptyLabel: string }) {
  if (items.length === 0) return <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>{emptyLabel}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <button key={s.id} type="button" onClick={() => onPick(s.dataUrl)} className="rounded-lg border p-1 transition" style={{ borderColor: selected === s.dataUrl ? "var(--accent)" : "var(--border)", background: selected === s.dataUrl ? "var(--accent-soft)" : "#fff" }} title={s.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.dataUrl} alt={s.name} className="h-9 w-20 object-contain" />
        </button>
      ))}
    </div>
  );
}

function AssetPreview({ asset, onUse, onClear, extra }: { asset: Asset | null; onUse: () => void; onClear: () => void; extra?: { label: string; onClick: () => void } }) {
  if (!asset || (!asset.dataUrl && !asset.text)) return null;
  return (
    <div className="rounded-lg border p-1.5" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
      <div className="flex items-center gap-2">
        {asset.dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.dataUrl} alt="aperçu" className="h-10 w-24 rounded bg-white object-contain" />
        ) : (
          <span className="flex-1 truncate text-[13px] font-semibold" style={{ color: "#0F172A" }}>{asset.text}</span>
        )}
        <button type="button" onClick={onClear} aria-label="Supprimer l'aperçu" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white">
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" onClick={onUse} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white" style={{ background: "var(--accent)" }}>
          <MousePointerClick className="h-3.5 w-3.5" strokeWidth={2.2} /> Utiliser
        </button>
        {extra ? <button type="button" onClick={extra.onClick} className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-bold" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}><Plus className="h-3.5 w-3.5" strokeWidth={2.4} /> {extra.label}</button> : null}
      </div>
    </div>
  );
}

function PadToggle({ open, onToggle, onGenerate, cta, defaultText = "" }: { open: boolean; onToggle: () => void; onGenerate: (d: string) => void; cta: string; defaultText?: string }) {
  return (
    <div>
      <button type="button" onClick={onToggle} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> {open ? "Fermer" : "Créer / dessiner / importer"}
      </button>
      {open ? <div className="mt-2"><SignaturePad defaultText={defaultText} ctaLabel={cta} onGenerate={onGenerate} /></div> : null}
    </div>
  );
}

function ThumbList({ numPages, thumbRefs, fields, currentPage, onPick }: { numPages: number; thumbRefs: React.MutableRefObject<(HTMLCanvasElement | null)[]>; fields: Field[]; currentPage: number; onPick: (n: number) => void }) {
  const paraPages = new Set(fields.filter((f) => f.type === "paraphe").map((f) => f.page));
  const sigPages = new Set(fields.filter((f) => f.type === "signature").map((f) => f.page));
  return (
    <div className="space-y-2">
      {Array.from({ length: numPages }, (_, i) => (
        <button key={i} type="button" onClick={() => onPick(i + 1)} className="block w-full rounded-lg border p-1 text-left transition" style={{ borderColor: currentPage === i + 1 ? "var(--accent)" : "var(--border)", background: currentPage === i + 1 ? "var(--accent-soft)" : "#fff" }}>
          <canvas ref={(el) => { thumbRefs.current[i] = el; }} className="mx-auto block w-full rounded border" style={{ borderColor: "var(--border)" }} />
          <div className="mt-1 flex items-center justify-between px-0.5">
            <span className="text-[10.5px] font-bold" style={{ color: "var(--text-muted)" }}>Page {i + 1}</span>
            <span className="flex gap-1">
              {paraPages.has(i + 1) ? <span title="Paraphée" className="h-2 w-2 rounded-full" style={{ background: "#15803D" }} /> : <span title="Non paraphée" className="h-2 w-2 rounded-full" style={{ background: "var(--border)" }} />}
              {sigPages.has(i + 1) ? <span title="Signée" className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} /> : null}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function FieldBox({ field, selected, onPointerDownMove, onPointerDownResize, onRemove, onDuplicate, onSelect, onText, onReplace }: {
  field: Field; selected: boolean;
  onPointerDownMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerDownResize: (e: React.PointerEvent<HTMLElement>) => void;
  onRemove: () => void; onDuplicate: () => void; onSelect: () => void; onText: (t: string) => void;
  onReplace: (dataUrl: string) => void;
}) {
  const isText = !field.dataUrl && (field.type === "date" || field.type === "lieu" || field.type === "text");
  return (
    <div
      onPointerDown={onPointerDownMove}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className="absolute touch-none"
      style={{
        left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.w * 100}%`, height: `${field.h * 100}%`,
        border: selected ? "1.5px solid var(--accent)" : "1px dashed rgba(247,92,141,0.5)",
        background: selected ? "rgba(247,92,141,0.06)" : "transparent", cursor: "move",
      }}
    >
      {field.dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={field.dataUrl} alt={field.label} className="pointer-events-none h-full w-full object-contain" />
      ) : isText ? (
        <input
          value={field.text ?? ""} onChange={(e) => onText(e.target.value)} onPointerDown={(e) => e.stopPropagation()}
          className="h-full w-full bg-transparent px-1 font-semibold outline-none"
          style={{ color: "#0F172A", fontSize: "clamp(9px, 2.2vw, 15px)" }}
        />
      ) : null}
      {selected ? (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} onPointerDown={(e) => e.stopPropagation()} aria-label="Dupliquer" className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-white shadow" style={{ background: "var(--accent)" }}>
            <Copy className="h-2.5 w-2.5" strokeWidth={2.5} />
          </button>
          {field.dataUrl ? (
            <label onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} title="Remplacer l'image" aria-label="Remplacer l'image" className="absolute -bottom-2 -left-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-white shadow" style={{ background: "#0F172A" }}>
              <ImageIcon className="h-2.5 w-2.5" strokeWidth={2.2} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void fileToPng(f).then(onReplace).catch(() => {}); e.target.value = ""; }} />
            </label>
          ) : null}
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} onPointerDown={(e) => e.stopPropagation()} aria-label="Supprimer" className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-white shadow" style={{ background: "var(--danger)" }}>
            <X className="h-3 w-3" strokeWidth={3} />
          </button>
          <span onPointerDown={onPointerDownResize} className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize touch-none rounded-full border-2 border-white" style={{ background: "var(--accent)" }} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}

function ResultView({ documentId, result }: { documentId: number; result: SignResult }) {
  const signedId = result.signedDocumentId;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#FCFAF7] p-6">
      <div className="w-full max-w-md rounded-3xl border bg-white p-6 text-center" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "#EAF8EF" }}>
          <PenLine className="h-6 w-6" style={{ color: "#15803D" }} strokeWidth={2} />
        </div>
        <h3 className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>Document signé créé</h3>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>{result.signedTitle}{result.pending ? " — indexation en cours…" : ""}</p>
        <div className="mt-5 grid gap-2">
          {signedId ? <Link href={`/documents/${signedId}`} className="flex h-11 items-center justify-center rounded-full text-[13.5px] font-bold text-white" style={{ background: "var(--accent)" }}>Ouvrir le document signé</Link> : null}
          {signedId ? <button type="button" onClick={() => openComposer({ subject: `Document signé : ${result.signedTitle}`, attachments: [{ documentId: signedId, name: result.signedTitle }] })} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border text-[13.5px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}><Mail className="h-4 w-4" /> Envoyer par mail</button> : null}
          {signedId ? <a href={`/api/paperless/documents/${signedId}/download`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border text-[13.5px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}><Download className="h-4 w-4" /> Télécharger</a> : null}
          <Link href={`/documents/${documentId}`} className="flex h-11 items-center justify-center rounded-full text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>Retour au document original</Link>
        </div>
      </div>
    </div>
  );
}
