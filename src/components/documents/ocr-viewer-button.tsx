"use client";

import { useMemo, useState } from "react";
import { Check, Copy, FileSearch, X } from "lucide-react";

/** Bouton « Afficher résultat OCR » → popup recherchable et copiable. */
export function OcrViewerButton({ content }: { content: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const text = content ?? "";

  const { html, count } = useMemo(() => {
    const term = query.trim();
    if (!term) return { html: null as string | null, count: 0 };
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${safe})`, "gi"));
    let n = 0;
    const out = parts
      .map((p) => {
        if (p.toLowerCase() === term.toLowerCase()) {
          n += 1;
          return `<mark style="background:#FDECF2;color:#D93E71;border-radius:3px">${esc(p)}</mark>`;
        }
        return esc(p);
      })
      .join("");
    return { html: out, count: n };
  }, [query, text]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold transition hover:bg-[#FCFAF7]"
        style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
      >
        <FileSearch className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        Afficher résultat OCR
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Résultat OCR">
          <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <span className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>
                <FileSearch className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Résultat OCR
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                  {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
                  {copied ? "Copié" : "Copier"}
                </button>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="border-b px-4 py-2" style={{ borderColor: "var(--border)" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher dans le texte..."
                className="h-9 w-full rounded-lg border px-3 text-[13px] outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border)" }}
              />
              {query.trim() ? (
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-hint)" }}>
                  {count} occurrence(s)
                </p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {text ? (
                html !== null ? (
                  <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6" style={{ color: "var(--text-main)" }} dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6" style={{ color: "var(--text-main)" }}>
                    {text}
                  </pre>
                )
              ) : (
                <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                  Aucun contenu OCR disponible pour ce document.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
