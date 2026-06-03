"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Search, SlidersHorizontal, Tag, Users } from "lucide-react";
import { MobileDocumentCard } from "@/components/mobile/mobile-document-card";
import { MobileFab } from "@/components/mobile/mobile-fab";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import type { DocumentVM } from "@/components/documents/types";
import type { DocumentFilterValues } from "@/components/documents/document-filters";

type Option = { id: number | string; name: string };

type Props = {
  docs: DocumentVM[];
  tab: string;
  filterValues: DocumentFilterValues;
  correspondents: Option[];
  types: Option[];
};

const TABS: { label: string; value: string }[] = [
  { label: "Tous", value: "" },
  { label: "À traiter", value: "a-traiter" },
  { label: "Archivés", value: "archives" },
];

/** Espace Documents en version « app mobile » (< md). */
export function MobileDocuments({ docs, tab, filterValues, correspondents, types }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fType, setFType] = useState(filterValues.document_type ?? "");
  const [fCorr, setFCorr] = useState(filterValues.correspondent ?? "");
  const [fDate, setFDate] = useState(filterValues.created_from ?? "");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.displayTitle.toLowerCase().includes(q) ||
        (d.correspondentName ?? "").toLowerCase().includes(q) ||
        (d.typeName ?? "").toLowerCase().includes(q),
    );
  }, [docs, search]);

  function tabHref(value: string): string {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set("tab", value);
    else p.delete("tab");
    return `/documents?${p.toString()}`;
  }

  function applyFilters() {
    const p = new URLSearchParams(searchParams.toString());
    const set = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
    set("document_type", fType);
    set("correspondent", fCorr);
    set("created_from", fDate);
    setSheetOpen(false);
    router.push(`/documents?${p.toString()}`);
  }

  function resetFilters() {
    setFType("");
    setFCorr("");
    setFDate("");
    setSheetOpen(false);
    const p = new URLSearchParams();
    if (tab) p.set("tab", tab);
    router.push(p.toString() ? `/documents?${p.toString()}` : "/documents");
  }

  const activeFilterCount = [filterValues.document_type, filterValues.correspondent, filterValues.created_from].filter(Boolean).length;

  return (
    <div className="px-4 py-4 md:hidden">
      {/* Recherche */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher dans vos documents…"
          className="h-12 w-full rounded-2xl border bg-white pl-10 pr-12 text-[14px] outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Filtres"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl"
          style={{ background: activeFilterCount ? "var(--accent-soft)" : "transparent", color: activeFilterCount ? "var(--accent)" : "var(--text-hint)" }}
        >
          <SlidersHorizontal className="h-5 w-5" strokeWidth={1.85} />
        </button>
      </div>

      {/* Onglets */}
      <div className="mb-3 flex gap-2">
        {TABS.map((t) => {
          const active = (tab || "") === t.value;
          return (
            <a
              key={t.value || "all"}
              href={tabHref(t.value)}
              className="flex-1 rounded-full py-2 text-center text-[13px] font-bold transition"
              style={{
                background: active ? "var(--accent)" : "#fff",
                color: active ? "#fff" : "var(--text-muted)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {t.label}
            </a>
          );
        })}
      </div>

      {/* Chips filtres rapides */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          { label: "Type", icon: Tag },
          { label: "Correspondant", icon: Users },
          { label: "Date", icon: CalendarDays },
          { label: "Plus de filtres", icon: SlidersHorizontal },
        ].map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[12.5px] font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" />
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun document</p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>Modifiez la recherche ou les filtres.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((doc) => <MobileDocumentCard key={doc.id} doc={doc} />)}
        </div>
      )}

      <MobileFab label="Nouveau document" href="/import" />

      {/* Bottom sheet filtres */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filtres">
        <div className="space-y-3 pb-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Type de document</span>
            <select value={fType} onChange={(e) => setFType(e.target.value)} className="h-11 w-full rounded-xl border px-3 text-[14px]" style={{ borderColor: "var(--border)" }}>
              <option value="">Tous</option>
              {types.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Correspondant</span>
            <select value={fCorr} onChange={(e) => setFCorr(e.target.value)} className="h-11 w-full rounded-xl border px-3 text-[14px]" style={{ borderColor: "var(--border)" }}>
              <option value="">Tous</option>
              {correspondents.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Date (à partir du)</span>
            <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="h-11 w-full rounded-xl border px-3 text-[14px]" style={{ borderColor: "var(--border)" }} />
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={resetFilters} className="h-12 flex-1 rounded-full border text-[14px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              Réinitialiser
            </button>
            <button type="button" onClick={applyFilters} className="h-12 flex-[1.5] rounded-full text-[14px] font-bold text-white" style={{ background: "var(--accent)" }}>
              Appliquer
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
