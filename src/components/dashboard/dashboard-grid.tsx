"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Pin,
  RefreshCw,
  Save,
  Settings2,
  X,
} from "lucide-react";
import type { DashboardData } from "@/lib/spaces/dashboard-data";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { StatWidget } from "@/components/dashboard/stat-widget";
import { ListWidget } from "@/components/dashboard/list-widget";
import { PinnedFoldersWidget } from "@/components/dashboard/pinned-folders-widget";
import { FavoritesCarouselWidget } from "@/components/dashboard/favorites-carousel-widget";
import { DashboardCalendarWidget } from "@/components/dashboard/dashboard-calendar-widget";
import {
  DASHBOARD_WIDGETS,
  DASHBOARD_WIDGETS_STORAGE_KEY,
  defaultVisibility,
  type GridWidgetKey,
  type WidgetKey,
} from "@/components/dashboard/widgets-config";

/* ── Types ─────────────────────────────────────────────────────────────── */

type Visibility = Record<WidgetKey, boolean>;

const ORDER_KEY = "ged-dashboard-order";
const DEFAULT_GRID_ORDER: GridWidgetKey[] = ["quick-actions", "epingles", "favoris", "documents", "messagerie", "finances", "ia", "calendrier", "contacts", "rappels", "administration"];

const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/* ── Persistence ──────────────────────────────────────────────────────── */

function readVisibility(): Visibility {
  const base = defaultVisibility();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(DASHBOARD_WIDGETS_STORAGE_KEY);
    if (!raw) return base;
    return { ...base, ...(JSON.parse(raw) as Partial<Visibility>) };
  } catch { return base; }
}

function readOrder(): GridWidgetKey[] {
  if (typeof window === "undefined") return DEFAULT_GRID_ORDER;
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return DEFAULT_GRID_ORDER;
    const stored: GridWidgetKey[] = JSON.parse(raw);
    // Ensure any new widget keys added later still appear
    const missing = DEFAULT_GRID_ORDER.filter((k) => !stored.includes(k));
    return [...stored, ...missing];
  } catch { return DEFAULT_GRID_ORDER; }
}

function saveVisibility(v: Visibility) {
  try { localStorage.setItem(DASHBOARD_WIDGETS_STORAGE_KEY, JSON.stringify(v)); } catch {}
}
function saveOrder(o: GridWidgetKey[]) {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(o)); } catch {}
}

/* ── Widget renderer ──────────────────────────────────────────────────── */

function renderGridWidget(
  key: GridWidgetKey,
  data: DashboardData,
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>,
) {
  switch (key) {
    case "quick-actions":
      return <QuickActionsCard />;
    case "epingles":
      return (
        <section className="flex h-full flex-col rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Pin className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
            </span>
            <h3 className="text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>Dossiers épinglés</h3>
            <Link href="/organiser" className="ml-auto text-[12px] font-bold" style={{ color: "var(--accent)" }}>Organiser</Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PinnedFoldersWidget />
          </div>
        </section>
      );
    case "favoris":
      return <FavoritesCarouselWidget />;
    case "documents":
      return (
        <StatWidget
          spaceId="documents" title="Documents"
          value={data.documents.total.toLocaleString("fr-FR")} label="documents"
          trend={`↗ +0 ce mois-ci`}
          ctaLabel="Voir tous les documents" dragHandleProps={dragHandleProps}
        />
      );
    case "messagerie":
      return (
        <StatWidget
          spaceId="messagerie" title="Messagerie"
          value={data.messagerie.unread} label="non lus"
          trend={`${data.messagerie.accounts} compte(s) connecté(s)`}
          ctaLabel="Voir la messagerie" dragHandleProps={dragHandleProps}
        />
      );
    case "finances":
      return (
        <StatWidget
          spaceId="finances" title="Finances"
          value={EURO.format(data.finances.toCollect)} label="à encaisser"
          trend={`↗ +0 € ce mois-ci`}
          ctaLabel="Voir les finances" dragHandleProps={dragHandleProps}
        />
      );
    case "ia":
      return (
        <StatWidget
          spaceId="ia" title="Analyse IA"
          value={data.ia.total} label="analyses générées"
          trend={`↗ +0 ce mois-ci`}
          ctaLabel="Voir l'analyse IA" dragHandleProps={dragHandleProps}
        />
      );
    case "calendrier":
      return <DashboardCalendarWidget />;
    case "contacts":
      return (
        <ListWidget
          spaceId="contacts" title="Contacts"
          value={data.contacts.total.toLocaleString("fr-FR")} label="contacts actifs"
          trend="+3 nouveaux ce mois-ci"
          avatarNames={["Alice Martin", "Marc Dupont", "Julie Renard", "Nadia Sow"]}
          extraCount={Math.max(0, data.contacts.total - 4)}
          ctaLabel="Voir tous les contacts" ctaHref="/correspondants"
          dragHandleProps={dragHandleProps}
        />
      );
    case "rappels":
      return (
        <ListWidget
          spaceId="rappels" title="Rappels"
          value={data.rappels.active} label="rappels actifs"
          agenda={data.rappels.items}
          ctaLabel="Voir tous les rappels" ctaHref="/rappels"
          dragHandleProps={dragHandleProps}
        />
      );
    case "administration":
      return (
        <ListWidget
          spaceId="administration" title="Administration"
          value={data.administration.alerts} label="alertes système"
          adminRows={data.administration.items}
          ctaLabel="Voir l'administration" ctaHref="/administration"
          dragHandleProps={dragHandleProps}
        />
      );
    default: return null;
  }
}

/* ── Main component ───────────────────────────────────────────────────── */

export function DashboardGrid({ data, userName }: { data: DashboardData; userName: string }) {
  const [visible, setVisible] = useState<Visibility>(() => readVisibility());
  const [order, setOrder] = useState<GridWidgetKey[]>(() => readOrder());
  const [panelOpen, setPanelOpen] = useState(false);
  const [reorgMode, setReorgMode] = useState(false);
  // savedOrder tracks the last-saved state to indicate unsaved changes in future
  const savedOrder = useRef<GridWidgetKey[]>(readOrder());

  const panelRef = useRef<HTMLDivElement>(null);
  const dragKey = useRef<GridWidgetKey | null>(null);
  const dragOverKey = useRef<GridWidgetKey | null>(null);

  // Source de vérité = base (par utilisateur) ; localStorage = cache. Au montage,
  // on charge la disposition serveur si elle existe et on l'applique.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/layout", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { layout: null }))
      .then((d: { layout?: { visibility?: Record<string, boolean>; order?: GridWidgetKey[] } | null }) => {
        if (cancelled || !d.layout) return;
        if (d.layout.visibility) setVisible((prev) => ({ ...prev, ...d.layout!.visibility }));
        if (Array.isArray(d.layout.order) && d.layout.order.length) {
          // Append les widgets ajoutés depuis (ex. « epingles ») absents de la
          // disposition enregistrée, sinon ils n'apparaîtraient jamais.
          const missing = DEFAULT_GRID_ORDER.filter((k) => !d.layout!.order!.includes(k));
          const merged = [...d.layout.order, ...missing];
          setOrder(merged);
          savedOrder.current = merged;
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function persistDb(vis: Visibility, ord: GridWidgetKey[]) {
    void fetch("/api/dashboard/layout", {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ visibility: vis, order: ord }),
    }).catch(() => {});
  }

  function toggleWidget(key: WidgetKey) {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveVisibility(next);
      persistDb(next, order);
      return next;
    });
  }

  /* ── HTML5 drag-and-drop ────────────────────────────────────────────── */
  function onDragStart(key: GridWidgetKey) {
    if (!reorgMode) return;
    dragKey.current = key;
  }
  function onDragOver(e: React.DragEvent, key: GridWidgetKey) {
    if (!reorgMode) return;
    e.preventDefault();
    dragOverKey.current = key;
  }
  function onDrop() {
    if (!reorgMode || !dragKey.current || !dragOverKey.current) return;
    if (dragKey.current === dragOverKey.current) return;
    const from = dragKey.current;
    const to = dragOverKey.current;
    setOrder((prev) => {
      const next = [...prev];
      const fi = next.indexOf(from);
      const ti = next.indexOf(to);
      if (fi < 0 || ti < 0) return prev;
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      return next;
    });
    dragKey.current = null;
    dragOverKey.current = null;
  }

  /**
   * Réorganisation tactile / accessible (smartphone & tablette) : déplace un
   * widget d'un cran parmi les widgets visibles, sans drag & drop natif.
   */
  function moveWidget(key: GridWidgetKey, dir: -1 | 1) {
    setOrder((prev) => {
      const vis = prev.filter((k) => visible[k]);
      const vi = vis.indexOf(key);
      const target = vis[vi + dir];
      if (vi < 0 || !target) return prev;
      const next = [...prev];
      const a = next.indexOf(key);
      const b = next.indexOf(target);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  function saveLayout() {
    saveOrder(order);
    savedOrder.current = order;
    setReorgMode(false);
    persistDb(visible, order);
  }
  function resetLayout() {
    setOrder(DEFAULT_GRID_ORDER);
    savedOrder.current = DEFAULT_GRID_ORDER;
    saveOrder(DEFAULT_GRID_ORDER);
    setReorgMode(false);
  }

  const gridVisible = order.filter((k) => visible[k]);
  const nothingVisible = gridVisible.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight sm:text-[26px]" style={{ color: "var(--text-main)" }}>
            Bonjour, {userName} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-[13px] sm:text-sm" style={{ color: "var(--text-muted)" }}>
            Voici ce qui se passe aujourd&apos;hui dans votre espace de travail.
          </p>
        </div>

        {/* Bouton Widgets dashboard */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-2 rounded-[20px] border-[1.5px] bg-white px-4 text-[13px] font-bold transition hover:bg-[#FCFAF7]"
            style={{ borderColor: "#374151", color: "#374151" }}
          >
            <Settings2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Widgets dashboard
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </button>

          {panelOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPanelOpen(false)} aria-hidden="true" />
              <div
                ref={panelRef}
                role="dialog"
                aria-label="Personnaliser les widgets"
                className="absolute right-0 top-11 z-50 w-72 rounded-2xl border bg-white p-2 shadow-xl"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-hint)" }}>
                    Widgets dashboard
                  </p>
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    aria-label="Fermer"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <ul className="max-h-[60vh] overflow-y-auto">
                  {DASHBOARD_WIDGETS.map((w) => (
                    <li key={w.key}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] hover:bg-slate-50" style={{ color: "var(--text-main)" }}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600"
                          checked={visible[w.key]}
                          onChange={() => toggleWidget(w.key)}
                        />
                        {w.label}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </header>

      {nothingVisible ? (
        <div className="rounded-2xl border border-dashed bg-white/60 px-6 py-12 text-center" style={{ borderColor: "var(--border)" }}>
          <LayoutGrid className="mx-auto mb-3 h-8 w-8 text-slate-300" strokeWidth={1.5} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Aucun widget affiché</p>
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-bold text-white"
            style={{ background: "var(--blue-600)" }}
          >
            <Settings2 className="h-4 w-4" strokeWidth={1.75} />
            Choisir des widgets
          </button>
        </div>
      ) : (
        <>
          {/* Grille UNIQUE et personnalisable : tout bloc (Actions rapides incluses)
              est déplaçable ; la largeur s'adapte (1 col → 2 → 3). */}
          {gridVisible.length > 0 ? (
              <div id="widgets" className="grid scroll-mt-24 grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3 2xl:gap-5">
              {gridVisible.map((key, idx) => {
                const label = DASHBOARD_WIDGETS.find((w) => w.key === key)?.label ?? key;
                const spanFull = key === "favoris" ? "sm:col-span-2 2xl:col-span-3" : "";
                return (
                  <div
                    key={key}
                    id={key === "quick-actions" ? "actions-rapides" : undefined}
                    draggable={reorgMode}
                    onDragStart={() => onDragStart(key)}
                    onDragOver={(e) => onDragOver(e, key)}
                    onDrop={onDrop}
                    className={`scroll-mt-24 ${spanFull} ${reorgMode ? "relative cursor-grab rounded-2xl outline-2 outline-dashed outline-blue-200" : "relative"}`}
                  >
                    {renderGridWidget(
                      key,
                      data,
                      reorgMode
                        ? { className: "text-slate-500 cursor-grab", "aria-label": "Déplacer le widget" }
                        : { className: "opacity-0 pointer-events-none" },
                    )}

                    {/* Surcouche de réorganisation : drag (desktop) + flèches (tactile) */}
                    {reorgMode && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/70 backdrop-blur-[1px]">
                        <span className="px-3 text-center text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>
                          {label}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moveWidget(key, -1)}
                            disabled={idx === 0}
                            aria-label={`Déplacer ${label} vers le haut`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white shadow-sm transition hover:bg-slate-50 disabled:opacity-30"
                            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                          >
                            <ChevronUp className="h-5 w-5" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveWidget(key, 1)}
                            disabled={idx === gridVisible.length - 1}
                            aria-label={`Déplacer ${label} vers le bas`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white shadow-sm transition hover:bg-slate-50 disabled:opacity-30"
                            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                          >
                            <ChevronDown className="h-5 w-5" strokeWidth={2} />
                          </button>
                        </div>
                        <span className="hidden text-[10.5px] sm:block" style={{ color: "var(--text-hint)" }}>
                          Glissez ou utilisez les flèches
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            ) : null}
        </>
      )}

      {/* Footer : personnalisation et réorganisation (empilé sur smartphone) */}
      <footer
        id="personnalisation"
        className="mt-6 flex scroll-mt-24 flex-col gap-4 rounded-2xl border bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} strokeWidth={1.75} />
          <div>
            <p className="text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>
              Personnalisez votre dashboard
            </p>
            <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              Déplacez, affichez ou masquez les widgets
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          {/* Toggle Mode réorganisation */}
          <label className="flex w-full cursor-pointer items-center justify-between gap-2.5 text-[13px] font-semibold sm:w-auto sm:justify-start" style={{ color: "var(--text-main)" }}>
            Mode réorganisation
            <button
              type="button"
              role="switch"
              aria-checked={reorgMode}
              onClick={() => setReorgMode((v) => !v)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ background: reorgMode ? "var(--blue-600)" : "#CBD5E1" }}
            >
              <span
                className="inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform"
                style={{ transform: reorgMode ? "translateX(22px)" : "translateX(2px)", width: 18, height: 18 }}
              />
            </button>
          </label>

          <button
            type="button"
            onClick={resetLayout}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[20px] border-[1.5px] px-4 text-[13px] font-bold transition hover:bg-[#FCFAF7] sm:flex-none"
            style={{ borderColor: "#374151", color: "#374151" }}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
            <span className="truncate">Réinitialiser<span className="hidden lg:inline"> la disposition</span></span>
          </button>

          <button
            type="button"
            onClick={saveLayout}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[20px] px-5 text-[13px] font-bold text-white transition hover:opacity-90 sm:flex-none"
            style={{ background: "var(--accent)" }}
          >
            <Save className="h-4 w-4" strokeWidth={1.75} />
            <span className="truncate">Enregistrer<span className="hidden lg:inline"> la disposition</span></span>
          </button>
        </div>
      </footer>
    </div>
  );
}
