import Link from "next/link";
import { ArrowRight, Bookmark, ExternalLink } from "lucide-react";

export type SavedViewVM = {
  id: string;
  name: string;
  onDashboard: boolean;
  inSidebar: boolean;
  sortField: string | null;
  href: string;
};

type SavedViewsManagerProps = {
  views: SavedViewVM[];
  paperlessUrl: string | null;
};

/**
 * Gestion des vues sauvegardées (recherches + filtres enregistrés dans
 * Gedify). Affichage groupé personnelles / mises en avant, navigation vers
 * le détail. La création se fait depuis Gedify ou la recherche avancée.
 */
export function SavedViewsManager({ views, paperlessUrl }: SavedViewsManagerProps) {
  const highlighted = views.filter((v) => v.onDashboard || v.inSidebar);
  const others = views.filter((v) => !v.onDashboard && !v.inSidebar);

  function renderView(view: SavedViewVM) {
    return (
      <Link
        key={view.id}
        href={view.href}
        className="group flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition hover:-translate-y-0.5"
        style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
      >
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(124,58,237,0.10)", color: "#7C3AED" }}>
          <Bookmark className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>
            {view.name}
          </span>
          <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
            {[view.onDashboard ? "Tableau de bord" : null, view.inSidebar ? "Sidebar" : null, view.sortField ? `Tri : ${view.sortField}` : null]
              .filter(Boolean)
              .join(" · ") || "Vue personnelle"}
          </span>
        </span>
        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" />
      </Link>
    );
  }

  if (views.length === 0) {
    return (
      <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
          Aucune vue sauvegardée
        </p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
          Enregistrez une recherche depuis la recherche avancée pour la retrouver en un clic.
        </p>
        <Link
          href="/recherche"
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "#7C3AED" }}
        >
          Ouvrir la recherche
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {highlighted.length > 0 ? (
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
            Mises en avant
          </p>
          <div className="grid gap-2 sm:grid-cols-2">{highlighted.map(renderView)}</div>
        </section>
      ) : null}

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
          Toutes les vues
        </p>
        <div className="grid gap-2 sm:grid-cols-2">{others.length > 0 ? others.map(renderView) : highlighted.length === 0 ? views.map(renderView) : null}</div>
      </section>

      {paperlessUrl ? (
        <a href={`${paperlessUrl}/saved-views`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "#7C3AED" }}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Gérer dans la GED
        </a>
      ) : null}
    </div>
  );
}
