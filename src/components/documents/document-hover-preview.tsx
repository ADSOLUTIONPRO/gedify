"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* ────────────────────────────────────────────────────────────────────────
   Aperçu flottant au survol de la miniature (vues Grille, Vignette, Liste).
   Au passage de la souris (pointeur fin uniquement), affiche après un court
   délai un aperçu IMAGE moyenne résolution (preview-image .webp) dans un
   popover positionné à côté de la miniature — jamais le PDF complet, et une
   seule image par survol (pas de requête par carte au rendu).
   ──────────────────────────────────────────────────────────────────────── */

const PREVIEW_W = 320; // largeur du popover (moyenne-petite)
const OPEN_DELAY = 260;

type Pos = { x: number; y: number };

export function DocumentHoverPreview({
  documentId,
  title,
  className,
  children,
}: {
  documentId: number;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  // Le popover n'est rendu qu'après un survol (événement client) → `document`
  // est toujours disponible, pas de souci d'hydratation SSR.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function show() {
    // Survol pertinent uniquement avec un vrai pointeur (souris/trackpad).
    if (typeof window !== "undefined" && window.matchMedia && !window.matchMedia("(hover: hover)").matches) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const estH = Math.min(440, window.innerHeight - 24);
      // À droite de la miniature ; bascule à gauche si ça déborde.
      let x = r.right + 12;
      if (x + PREVIEW_W > window.innerWidth - 8) x = Math.max(8, r.left - PREVIEW_W - 12);
      const y = Math.min(Math.max(8, r.top - 8), window.innerHeight - estH - 8);
      setPos({ x, y });
    }, OPEN_DELAY);
  }

  function hide() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setPos(null);
  }

  return (
    <div ref={ref} className={className} onMouseEnter={show} onMouseLeave={hide} onMouseDown={hide}>
      {children}
      {pos
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[120] overflow-hidden rounded-2xl border bg-white shadow-2xl"
              style={{ left: pos.x, top: pos.y, width: PREVIEW_W, borderColor: "var(--border)" }}
              role="img"
              aria-label={title ? `Aperçu — ${title}` : "Aperçu du document"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/paperless/documents/${documentId}/preview-image`}
                alt=""
                className="block max-h-[440px] w-full object-contain"
                style={{ background: "#F4F0E8" }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
