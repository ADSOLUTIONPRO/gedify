"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Star } from "lucide-react";
import { spaces } from "@/config/spaces";
import type { LucideIcon } from "lucide-react";

const FAVORITES_KEY = "ged-app-launcher-favorites";

function getInitialFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : ["documents", "messagerie", "finances", "ia"];
  } catch {
    return ["documents", "messagerie", "finances", "ia"];
  }
}

function AppTile({
  id,
  label,
  icon: Icon,
  image,
  color,
  href,
  isFav,
  isActive,
  onToggleFav,
  onClick,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  image?: string;
  color: string;
  href: string;
  isFav: boolean;
  isActive: boolean;
  onToggleFav: (id: string) => void;
  onClick: () => void;
}) {
  return (
    <div className="group relative flex flex-col items-center gap-2 rounded-xl p-3 transition hover:bg-slate-50">
      <Link
        href={href}
        onClick={onClick}
        className="flex flex-col items-center gap-2 w-full"
        aria-current={isActive ? "page" : undefined}
      >
        {image ? (
          // Icône image premium : carré, jamais déformée/rognée (object-contain).
          <span className="flex h-14 w-14 items-center justify-center transition group-hover:scale-105">
            <Image
              src={image}
              alt={label}
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
            />
          </span>
        ) : (
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition group-hover:shadow-md"
            style={{ background: `${color}15`, border: `1.5px solid ${color}30` }}
          >
            <Icon className="h-7 w-7" style={{ color }} strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
        <span className="text-center text-[12px] font-semibold leading-tight" style={{ color: "var(--text-main)" }}>
          {label}
        </span>
      </Link>
      {/* Favori */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFav(id); }}
        aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100"
        style={{ color: isFav ? "#F59E0B" : "var(--text-hint)" }}
      >
        <Star className="h-3.5 w-3.5" strokeWidth={isFav ? 0 : 1.75} fill={isFav ? "#F59E0B" : "none"} />
      </button>
    </div>
  );
}

export function AppLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Initialisation lazy pour éviter setState dans useEffect (règle react-hooks)
  const [favorites, setFavorites] = useState<string[]>(() => getInitialFavorites());
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggleFav(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const favSpaces = spaces.filter((s) => favorites.includes(s.id));
  const otherSpaces = spaces.filter((s) => !favorites.includes(s.id));

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Applications"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-100"
        style={{ color: open ? "var(--blue-600)" : "var(--text-muted)" }}
      >
        <LayoutGrid className="h-5 w-5" strokeWidth={1.75} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-12 z-50 w-[380px] rounded-2xl border bg-white py-4 shadow-xl"
          style={{
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-xl)",
            maxHeight: "calc(100vh - 80px)",
            overflowY: "auto",
          }}
          role="dialog"
          aria-label="Lanceur d'applications"
        >
          <div className="px-4 pb-1">
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-hint)" }}>
              Gedify
            </h2>
          </div>

          {/* Favoris */}
          {favSpaces.length > 0 && (
            <div className="px-3">
              <p className="mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>
                Vos favoris
              </p>
              <div className="grid grid-cols-4 gap-0.5">
                {favSpaces.map((space) => (
                  <AppTile
                    key={space.id}
                    id={space.id}
                    label={space.label}
                    icon={space.icon}
                    image={space.image}
                    color={space.color}
                    href={space.href}
                    isFav
                    isActive={pathname === space.href || pathname.startsWith(`${space.href}/`)}
                    onToggleFav={toggleFav}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Séparateur */}
          {favSpaces.length > 0 && otherSpaces.length > 0 && (
            <div className="mx-4 my-3 border-t" style={{ borderColor: "var(--border-soft)" }} />
          )}

          {/* Tous les espaces */}
          {otherSpaces.length > 0 && (
            <div className="px-3">
              {favSpaces.length > 0 && (
                <p className="mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>
                  Tous les espaces
                </p>
              )}
              <div className="grid grid-cols-4 gap-0.5">
                {otherSpaces.map((space) => (
                  <AppTile
                    key={space.id}
                    id={space.id}
                    label={space.label}
                    icon={space.icon}
                    image={space.image}
                    color={space.color}
                    href={space.href}
                    isFav={false}
                    isActive={pathname === space.href || pathname.startsWith(`${space.href}/`)}
                    onToggleFav={toggleFav}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mx-4 mt-3 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
            <p className="text-center text-[10.5px]" style={{ color: "var(--text-hint)" }}>
              Survolez une icône pour l&apos;épingler ★
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
