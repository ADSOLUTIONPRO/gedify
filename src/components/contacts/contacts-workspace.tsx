"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, Settings2, Users } from "lucide-react";
import { initials } from "@/components/messaging/mail-list-utils";
import { ContactDetailView } from "./contact-detail-view";

const BLUE = "#0a84ff";
const BLUE2 = "#eaf4ff";
const SIDEBAR_BG = "#f7f8fb";
const LINE = "#e6e6eb";
const HINT = "#8e8e93";

export type ContactVM = {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  emails: string[];
  phone: string | null;
  source: "google" | "imap_email" | "manual" | "correspondent";
  address?: string | null;
  notes?: string | null;
  correspondentId?: number | null;
  documentCount?: number | null;
};

type ListKey = "all" | "google" | "imap_email" | "correspondents" | "manual" | "doublons";

const SOURCE_PILL: Record<ContactVM["source"], { label: string } | null> = {
  google: { label: "Google" },
  imap_email: { label: "Email" },
  manual: { label: "Manuel" },
  correspondent: null,
};

type Props = {
  contacts: ContactVM[];
  correspondents: ContactVM[];
  duplicateIds: string[];
};

export function ContactsWorkspace({ contacts, correspondents, duplicateIds }: Props) {
  const [items, setItems] = useState<ContactVM[]>(contacts);
  const [list, setList] = useState<ListKey>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startEditingId, setStartEditingId] = useState<string | null>(null);

  const dupSet = useMemo(() => new Set(duplicateIds), [duplicateIds]);

  const counts = useMemo(
    () => ({
      all: items.length,
      google: items.filter((c) => c.source === "google").length,
      imap_email: items.filter((c) => c.source === "imap_email").length,
      manual: items.filter((c) => c.source === "manual").length,
      correspondents: correspondents.length,
      doublons: items.filter((c) => dupSet.has(c.id)).length,
    }),
    [items, correspondents.length, dupSet],
  );

  const LISTS: { key: ListKey; label: string; glyph: string }[] = [
    { key: "all", label: "Tous les contacts", glyph: "◎" },
    { key: "google", label: "Google", glyph: "G" },
    { key: "imap_email", label: "Emails / IMAP", glyph: "✉" },
    { key: "correspondents", label: "Correspondants GEDify", glyph: "◉" },
    { key: "manual", label: "Manuels", glyph: "✎" },
    { key: "doublons", label: "Doublons possibles", glyph: "⧉" },
  ];

  const activeList = useMemo<ContactVM[]>(() => {
    switch (list) {
      case "google": return items.filter((c) => c.source === "google");
      case "imap_email": return items.filter((c) => c.source === "imap_email");
      case "manual": return items.filter((c) => c.source === "manual");
      case "correspondents": return correspondents;
      case "doublons": return items.filter((c) => dupSet.has(c.id));
      default: return items;
    }
  }, [list, items, correspondents, dupSet]);

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase();
    const base = kw
      ? activeList.filter((c) => `${c.name} ${c.organization ?? ""} ${c.email ?? ""}`.toLowerCase().includes(kw))
      : activeList;
    return [...base].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [activeList, query]);

  // Regroupement alphabétique.
  const groups = useMemo(() => {
    const map = new Map<string, ContactVM[]>();
    for (const c of filtered) {
      const first = (c.name.trim()[0] ?? "#").toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    }
    return [...map.entries()];
  }, [filtered]);

  const effectiveSelected = useMemo(() => {
    if (selectedId && filtered.some((c) => c.id === selectedId)) return selectedId;
    return filtered[0]?.id ?? null;
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => [...items, ...correspondents].find((c) => c.id === effectiveSelected) ?? null,
    [items, correspondents, effectiveSelected],
  );

  const activeLabel = LISTS.find((l) => l.key === list)?.label ?? "Tous les contacts";

  function selectList(key: ListKey) {
    setList(key);
    setSelectedId(null);
  }

  async function createContact() {
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayName: "Nouveau contact" }),
      });
      const data = (await res.json().catch(() => ({}))) as { contact?: { resourceName: string } };
      if (res.ok && data.contact) {
        const vm: ContactVM = { id: data.contact.resourceName, name: "Nouveau contact", organization: null, email: null, emails: [], phone: null, source: "manual" };
        setItems((prev) => [vm, ...prev]);
        setList("manual");
        setSelectedId(vm.id);
        setStartEditingId(vm.id);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="grid h-[calc(100vh-53px)] bg-white"
      style={{ gridTemplateColumns: "minmax(0,290px) minmax(0,460px) 1fr" }}
    >
      {/* ════════ Colonne 1 — Listes ════════ */}
      <aside className="hidden min-h-0 flex-col border-r md:flex" style={{ background: SIDEBAR_BG, borderColor: LINE }}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: LINE }}>
          <div className="flex items-center gap-2.5 font-extrabold" style={{ color: "#1d1d1f" }}>
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[14px] text-white" style={{ background: BLUE }}>G</span>
            GEDify Contacts
          </div>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: BLUE }} aria-label="Réglages">
            <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3.5">
          <div className="flex items-center justify-between px-2 pb-2.5">
            <h2 className="text-[26px] font-extrabold" style={{ color: "#1d1d1f" }}>Listes</h2>
            <button type="button" onClick={() => void createContact()} className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: BLUE }} aria-label="Nouveau contact">
              <Plus className="h-[20px] w-[20px]" strokeWidth={2} />
            </button>
          </div>
          {LISTS.map((l) => {
            const active = list === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => selectList(l.key)}
                className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[15px] transition"
                style={{ background: active ? "#e3e6ee" : "transparent", color: "#1d1d1f", fontWeight: active ? 600 : 400 }}
              >
                <span className="w-4 text-center font-bold" style={{ color: BLUE }}>{l.glyph}</span>
                <span className="flex-1 truncate">{l.label}</span>
                <span className="text-[13px]" style={{ color: HINT }}>{counts[l.key].toLocaleString("fr-FR")}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ════════ Colonne 2 — Liste des contacts ════════ */}
      <section className="flex min-h-0 flex-col border-r bg-white" style={{ borderColor: LINE }}>
        <div className="shrink-0 border-b px-3 py-2.5" style={{ borderColor: LINE }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: HINT }} strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Rechercher dans ${activeLabel}`}
              className="h-10 w-full rounded-xl border-0 pl-9 pr-3 text-[15px] outline-none"
              style={{ background: "#f1f1f4", color: "#1d1d1f" }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center" style={{ color: HINT }}>
              <Users className="mb-2 h-9 w-9" strokeWidth={1.25} />
              <p className="text-[14px] font-semibold" style={{ color: "#1d1d1f" }}>Aucun contact</p>
            </div>
          ) : (
            groups.map(([letter, list]) => (
              <div key={letter}>
                <div className="px-3 pb-1 pt-2 text-[13px] font-extrabold" style={{ color: HINT }}>{letter}</div>
                {list.map((c) => {
                  const active = c.id === effectiveSelected;
                  const pill = SOURCE_PILL[c.source];
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition"
                      style={{ background: active ? BLUE : "transparent", color: active ? "#fff" : "#1d1d1f" }}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: active ? "#fff" : BLUE2, color: BLUE }}>
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold leading-tight">{c.name}</span>
                        <span className="block truncate text-[13px]" style={{ color: active ? "#dbeaff" : "#6e6e73" }}>
                          {c.organization ?? (c.source === "correspondent" ? "Correspondant GEDify" : c.email ?? "")}
                        </span>
                      </span>
                      {pill ? (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: active ? "#fff" : BLUE2, color: BLUE }}>
                          {pill.label}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ════════ Colonne 3 — Fiche ════════ */}
      <section
        className={`fixed inset-0 z-50 bg-white md:static md:z-auto md:flex ${selectedId ? "flex" : "hidden md:flex"} min-h-0 flex-col`}
      >
        {/* Retour (mobile) */}
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex h-12 shrink-0 items-center gap-1.5 border-b px-4 text-[15px] font-medium md:hidden"
          style={{ borderColor: LINE, color: BLUE }}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Listes
        </button>
        <div className="min-h-0 flex-1">
          <ContactDetailView
            key={selected?.id ?? "none"}
            contact={selected}
            startEditing={selected?.id === startEditingId}
            onSaved={(updated) => {
              setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
              setStartEditingId(null);
            }}
            onDeleted={(id) => {
              setItems((prev) => prev.filter((c) => c.id !== id));
              setSelectedId(null);
              setStartEditingId(null);
            }}
          />
        </div>
      </section>
    </div>
  );
}
