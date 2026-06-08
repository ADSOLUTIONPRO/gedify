"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, PanelLeft, X } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { SidebarFolderTree } from "@/components/organiser/sidebar-folder-tree";
import { AgendaSidebarExtras } from "@/components/calendar/agenda-sidebar-extras";
import { getSpaceById } from "@/config/spaces";
import { getActiveSpaceId, getSpaceMenu, type SpaceMenu, type SpaceMenuItem } from "@/config/space-menus";

/* ── Détection de l'item actif (gère pathname, query et ancres) ────────── */

function splitHref(href: string) {
  const noHash = href.split("#")[0];
  const hash = href.includes("#");
  const [path, query = ""] = noHash.split("?");
  return { path, query, hash };
}

function activeIndex(menu: SpaceMenu, pathname: string, search: string): number {
  const items = menu.items;
  const full = pathname + (search ? `?${search}` : "");
  // 1) Correspondance exacte (href complet, query comprise)
  let idx = items.findIndex((it) => !splitHref(it.href).hash && it.href === full);
  if (idx >= 0) return idx;
  if (search) return -1; // URL avec query mais aucun item exact → rien d'actif
  // 2) Correspondance exacte de pathname (item sans query)
  idx = items.findIndex((it) => {
    const s = splitHref(it.href);
    return !s.hash && !s.query && s.path === pathname;
  });
  if (idx >= 0) return idx;
  // 3) Préfixe le plus profond (sous-pages : /documents/123)
  let best = -1;
  let bestLen = -1;
  items.forEach((it, i) => {
    const s = splitHref(it.href);
    if (s.hash || s.query) return;
    if ((pathname === s.path || pathname.startsWith(s.path + "/")) && s.path.length > bestLen) {
      bestLen = s.path.length;
      best = i;
    }
  });
  return best;
}

/* ── Ligne de menu (icône + libellé + sous-titre éventuel) ─────────────── */

function MenuRow({ item, active, onNavigate }: { item: SpaceMenuItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition ${active ? "" : "font-medium hover:bg-black/[0.04]"}`}
        style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-muted)" }}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.2 : 1.85} style={{ color: active ? "var(--accent)" : "var(--text-hint)" }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.label}</span>
          {item.subtitle ? <span className="block truncate text-[10.5px] font-normal" style={{ color: active ? "var(--accent)" : "var(--text-hint)" }}>{item.subtitle}</span> : null}
        </span>
      </Link>
    </li>
  );
}

/* ── Contenu réutilisable (colonne desktop + drawer mobile) ────────────── */

function SpaceMenuInner({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const activeId = getActiveSpaceId(pathname);
  const menu = getSpaceMenu(activeId);
  const space = getSpaceById(activeId);
  const color = menu.color ?? space?.color ?? "#F75C8D";
  const HeaderIcon = space?.icon ?? Home;
  const active = activeIndex(menu, pathname, search);
  const ActionIcon = menu.action?.icon;

  return (
    <div className="flex h-full flex-col">
      {/* Marque */}
      <Link href="/" onClick={onNavigate} className="flex items-center px-4 pt-4 pb-1" aria-label="Accueil Gedify">
        <BrandLogo variant="full" className="h-7 w-auto" />
      </Link>

      {/* En-tête de l'espace */}
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}18` }}>
            {HeaderIcon ? <HeaderIcon className="h-[18px] w-[18px]" style={{ color }} strokeWidth={2} aria-hidden="true" /> : null}
          </span>
          <h2 className="min-w-0 truncate text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>
            {menu.title}
          </h2>
        </div>
        {menu.description ? (
          <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
            {menu.description}
          </p>
        ) : null}

        {menu.action ? (
          <Link
            href={menu.action.href}
            onClick={onNavigate}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[20px] text-[13px] font-bold text-white transition hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            {ActionIcon ? <ActionIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> : null}
            {menu.action.label}
          </Link>
        ) : null}
      </div>

      {/* Liste du menu (groupée si `menu.groups`, sinon plate) */}
      <nav className={`${activeId === "organiser" || activeId === "agenda" ? "" : "flex-1"} overflow-y-auto px-2 pb-2`}>
        {menu.groups && menu.groups.length > 0 ? (
          <>
          {/* Items sans groupe → rendus en tête (ex. « Vue d'ensemble »). */}
          {menu.items.some((it) => !it.group) ? (
            <ul className="mb-2 space-y-0.5">
              {menu.items.filter((it) => !it.group).map((item) => (
                <MenuRow key={item.href} item={item} active={menu.items.indexOf(item) === active} onNavigate={onNavigate} />
              ))}
            </ul>
          ) : null}
          {menu.groups.map((group, gi) => {
            const groupItems = menu.items.filter((it) => it.group === group.id);
            if (groupItems.length === 0) return null;
            return (
              <div key={group.id} className={gi > 0 ? "mt-3 border-t pt-3" : ""} style={gi > 0 ? { borderColor: "var(--border-soft)" } : undefined}>
                <div className="px-2.5 pb-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--text-hint)" }}>{group.title}</p>
                  {group.subtitle ? <p className="text-[10.5px]" style={{ color: "var(--text-hint)" }}>{group.subtitle}</p> : null}
                </div>
                <ul className="space-y-0.5">
                  {groupItems.map((item) => (
                    <MenuRow key={item.href} item={item} active={menu.items.indexOf(item) === active} onNavigate={onNavigate} />
                  ))}
                </ul>
              </div>
            );
          })}
          </>
        ) : (
          <ul className="space-y-0.5">
            {menu.items.map((item, i) => (
              <MenuRow key={item.href} item={item} active={i === active} onNavigate={onNavigate} />
            ))}
          </ul>
        )}
      </nav>

      {/* Espace Organiser : arbre des dossiers directement dans la barre */}
      {activeId === "organiser" ? (
        <div className="flex min-h-0 flex-1 flex-col border-t px-2 pb-4 pt-3" style={{ borderColor: "var(--border)" }}>
          <SidebarFolderTree onNavigate={onNavigate} />
        </div>
      ) : null}

      {/* Espace Agenda : mini-calendrier + agendas (cases on/off + iCloud) */}
      {activeId === "agenda" ? (
        <div className="min-h-0 flex-1 overflow-y-auto border-t px-3 pb-4 pt-3" style={{ borderColor: "var(--border)" }}>
          <AgendaSidebarExtras onNavigate={onNavigate} />
        </div>
      ) : null}
    </div>
  );
}

/* ── Zone 2 — Colonne desktop ──────────────────────────────────────────── */

/**
 * Sidebar dédiée à l'espace actif. Le menu change selon la route courante
 * (`getActiveSpaceId`). Masquée sous `lg` → accessible via `MobileSpaceMenu`.
 */
export function SpaceMenuSidebar({ financeEnabled = true }: { financeEnabled?: boolean }) {
  const pathname = usePathname();
  // L'espace Messagerie a sa propre sidebar complète (MessagerieShell) → on masque
  // la sidebar générique d'espace ici pour n'en afficher qu'une seule.
  if (pathname.startsWith("/messagerie")) return null;
  // La page Correspondants est un espace de travail « master-detail » pleine
  // largeur (liste + fiche) → pas de sidebar secondaire.
  if (pathname === "/correspondants" || pathname.startsWith("/correspondants?")) return null;
  // La page unique Paramètres a sa propre sidebar d'ancres (scroll-spy).
  if (pathname === "/administration/parametres") return null;
  // Module Finances désactivé : pas de sous-menu finances (l'accès est gardé par
  // /finances/layout.tsx qui affiche le message « espace désactivé »).
  if (!financeEnabled && (pathname.startsWith("/finances") || pathname.startsWith("/budget"))) return null;
  return (
    <aside
      className="sticky z-20 hidden w-60 shrink-0 border-r md:block"
      style={{ background: "var(--surface-muted)", borderColor: "var(--border-soft)", top: "var(--titlebar-h,0px)", height: "calc(100dvh - var(--titlebar-h,0px))" }}
      aria-label="Menu de l'espace actif"
    >
      <Suspense fallback={null}>
        <SpaceMenuInner />
      </Suspense>
    </aside>
  );
}

/* ── Déclinaison mobile : bouton (topbar) + drawer coulissant ──────────── */

/** Bouton + drawer pour accéder au menu de l'espace sur mobile / tablette. */
export function MobileSpaceMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu de l'espace"
        title="Menu de l'espace"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-slate-50 md:hidden"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <PanelLeft className="h-5 w-5" strokeWidth={1.85} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Menu de l'espace">
          <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-900/40" />
          <div
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r shadow-2xl"
            style={{ background: "var(--surface-muted)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-end p-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Suspense fallback={null}>
                <SpaceMenuInner onNavigate={() => setOpen(false)} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
