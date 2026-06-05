"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";

/* Indicateur GLOBAL non bloquant de traitement (import → OCR/IA/miniatures…).
   Pastille en bas à droite : « N document(s) en traitement », visible pendant la
   navigation. Disparaît quand la file est vide (avec un bref « Terminé »).
   N'empêche jamais l'utilisation de l'app. */

type Active = { total: number; pending: number; processing: number; failed: number; byType: Record<string, number> };

const TYPE_LABEL: Record<string, string> = {
  ocr: "OCR",
  ai: "Analyse IA",
  thumbnail: "Miniatures",
  preview: "Aperçus",
  index: "Indexation",
};

export function ImportActivityIndicator() {
  const [active, setActive] = useState<Active | null>(null);
  const [open, setOpen] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const prevTotal = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/active", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Active;
      // Transition >0 → 0 : court message « Terminé ».
      if (prevTotal.current > 0 && data.total === 0) {
        setJustDone(true);
        setTimeout(() => setJustDone(false), 4000);
      }
      prevTotal.current = data.total;
      setActive(data);
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  const total = active?.total ?? 0;
  if (total === 0 && !justDone) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && total > 0 ? (
        <div className="mb-2 w-72 rounded-2xl border bg-white p-3 shadow-2xl" style={{ borderColor: "var(--border)" }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-extrabold" style={{ color: "var(--text-main)" }}>Traitement en cours</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Réduire" className="text-slate-400 hover:text-slate-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="space-y-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            {Object.entries(active?.byType ?? {}).map(([type, n]) => (
              <li key={type} className="flex items-center justify-between">
                <span>{TYPE_LABEL[type] ?? type}</span>
                <strong>{n}</strong>
              </li>
            ))}
            {active && active.failed > 0 ? (
              <li className="flex items-center justify-between text-rose-600">
                <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Échecs</span>
                <strong>{active.failed}</strong>
              </li>
            ) : null}
          </ul>
          <Link href="/administration/sante" onClick={() => setOpen(false)} className="mt-2 block text-[11.5px] font-semibold" style={{ color: "var(--blue-600)" }}>
            Voir la file de traitement →
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-full border bg-white pl-3 pr-4 text-[13px] font-bold shadow-lg transition hover:shadow-xl"
        style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
      >
        {total > 0 ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--blue-600)" }} />
            {total} en traitement
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" style={{ color: "#16A34A" }} />
            Traitement terminé
          </>
        )}
      </button>
    </div>
  );
}
