"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ScanText } from "lucide-react";

type OcrInfo = {
  ocr_status: string | null;
  ocr_source: string | null;
  ocr_engine: string | null;
  ocr_language: string | null;
  ocr_confidence: number | null;
  ocr_quality: string | null;
  ocr_text_length: number | null;
  ocr_pages_count: number | null;
  ocr_finished_at: string | null;
  ocr_attempts: number | null;
};

const SOURCE_LABEL: Record<string, string> = {
  native_pdf_text: "Texte PDF natif",
  ocr_engine: "OCR (Tesseract)",
  text_file: "Fichier texte",
  unavailable: "Indisponible",
};

export function DocumentOcrInfo({ documentId }: { documentId: number }) {
  const [info, setInfo] = useState<OcrInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/ocr-info`, { credentials: "include", cache: "no-store" });
      if (res.ok) setInfo((await res.json()) as OcrInfo);
    } catch {
      /* ignore */
    }
  }, [documentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const relaunch = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/redo-ocr`, { method: "POST", credentials: "include" });
      setMsg(res.ok ? "OCR relancé — mise à jour sous peu." : "Échec du relancement.");
      setTimeout(() => void load(), 3000);
    } catch {
      setMsg("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }, [documentId, load]);

  if (!info) return null;

  const rows: { label: string; value: string }[] = [
    { label: "Statut", value: info.ocr_status ?? "—" },
    { label: "Source", value: info.ocr_source ? SOURCE_LABEL[info.ocr_source] ?? info.ocr_source : "—" },
    { label: "Moteur", value: info.ocr_engine ?? "—" },
    { label: "Langue", value: info.ocr_language ?? "—" },
    { label: "Pages", value: info.ocr_pages_count != null ? String(info.ocr_pages_count) : "—" },
    { label: "Longueur texte", value: info.ocr_text_length != null ? `${info.ocr_text_length} car.` : "—" },
    { label: "Confiance", value: info.ocr_confidence != null ? `${info.ocr_confidence} %` : "—" },
    { label: "Qualité", value: info.ocr_quality === "low" ? "Faible ⚠️" : info.ocr_quality === "good" ? "Bonne" : "—" },
    { label: "Dernier OCR", value: info.ocr_finished_at ? new Date(info.ocr_finished_at).toLocaleString("fr-FR") : "—" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {info.ocr_quality === "low" ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
          OCR faible : le texte extrait semble incomplet. L&apos;analyse IA peut être moins fiable — vous pouvez relancer l&apos;OCR.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <dt className="text-slate-400">{r.label}</dt>
            <dd className="font-semibold" style={{ color: "var(--text-main)" }}>{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void relaunch()}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold transition hover:bg-slate-50 disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
          Relancer l&apos;OCR
        </button>
        {msg ? <span className="text-[12px] font-semibold text-emerald-700">{msg}</span> : null}
        {!msg ? <ScanText className="h-3.5 w-3.5 text-slate-300" /> : null}
      </div>
    </div>
  );
}
