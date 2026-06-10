"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Pin } from "lucide-react";
import { DocumentHoverPreview } from "@/components/documents/document-hover-preview";

type FavoriteDoc = { id: number; title: string; correspondent: string | null };

type PaperlessDoc = { id: number; title?: string; correspondent__name?: string | null };

/**
 * Widget tableau de bord : documents ÉPINGLÉS en CARROUSEL horizontal (miniature
 * + titre, flèches gauche/droite). Récupère ses propres données (ids épinglés →
 * détails documents). Clic sur une carte → page du document. Aperçu moyen au
 * survol de la miniature (cohérent avec les vues Documents).
 */
export function FavoritesCarouselWidget() {
  const [docs, setDocs] = useState<FavoriteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const favRes = await fetch("/api/documents/favorites", { credentials: "include", cache: "no-store" });
      const fav = (await favRes.json()) as { ids?: number[] };
      const ids = fav.ids ?? [];
      if (ids.length === 0) { setDocs([]); return; }
      const params = new URLSearchParams({ id__in: ids.join(","), page_size: String(Math.min(ids.length, 60)), ordering: "-added" });
      const res = await fetch(`/api/paperless/documents?${params.toString()}`, { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { results?: PaperlessDoc[] };
      setDocs(
        (data.results ?? []).map((d) => ({
          id: Number(d.id),
          title: d.title || `Document ${d.id}`,
          correspondent: d.correspondent__name ?? null,
        })),
      );
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  function scrollBy(dir: -1 | 1) {
    scroller.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Pin className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
        </span>
        <h3 className="text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>Documents épinglés</h3>
        {docs.length > 0 ? (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Précédent" className="flex h-7 w-7 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}>
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Suivant" className="flex h-7 w-7 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}>
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl px-3 py-6 text-center" style={{ background: "var(--bg-card-soft)" }}>
          <Pin className="mx-auto h-5 w-5" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-1.5 text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun document épinglé</p>
          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>Épinglez des documents avec l&apos;épingle pour les retrouver ici.</p>
        </div>
      ) : (
        <div ref={scroller} className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {docs.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="group w-[148px] shrink-0 cursor-pointer snap-start overflow-hidden bg-white transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <DocumentHoverPreview documentId={doc.id} title={doc.title} className="relative block h-[116px] w-full overflow-hidden bg-[#F4F0E8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/paperless/documents/${doc.id}/thumb`} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
              </DocumentHoverPreview>
              <div className="p-2">
                <p className="truncate text-[12px] font-bold" style={{ color: "var(--gedify-navy)" }} title={doc.title}>{doc.title}</p>
                {doc.correspondent ? (
                  <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{doc.correspondent}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
