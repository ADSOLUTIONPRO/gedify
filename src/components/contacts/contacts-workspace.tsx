"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, Search, Settings2, Users } from "lucide-react";
import { initials } from "@/components/messaging/mail-list-utils";
import { ContactDetailView } from "./contact-detail-view";

/* ── Thème commun « communication » (rouge), partagé avec Messagerie ─────── */
const RED = "var(--accent)";
const RED2 = "var(--accent-soft)";
const SIDEBAR_BG = "var(--surface-muted)";
const LINE = "var(--border)";
const HINT = "var(--text-hint)";

export type ContactVM = {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  emails: string[];
  phone: string | null;
  source: "email" | "manual" | "correspondent";
  address?: string | null;
  notes?: string | null;
  correspondentId?: number | null;
  documentCount?: number | null;
  linkedEmailsCount?: number;
  linkedGedDocumentsCount?: number;
  linkedDocumentIds?: number[];
  lastInteractionAt?: string | null;
};

type ListKey = "all" | "correspondents";

type Props = {
  contacts: ContactVM[];
  correspondents: ContactVM[];
  accountConnected?: boolean;
  importedLinks?: number;
};

export function ContactsWorkspace({ contacts, correspondents, accountConnected = false, importedLinks = 0 }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ContactVM[]>(contacts);
  const [list, setList] = useState<ListKey>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const LISTS: { key: ListKey; label: string; glyph: string; count: number }[] = [
    { key: "all", label: "Contacts liés à la GED", glyph: "◉", count: items.length },
    { key: "correspondents", label: "Correspondants GEDify", glyph: "◎", count: correspondents.length },
  ];

  const activeList = list === "correspondents" ? correspondents : items;

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase();
    const base = kw
      ? activeList.filter((c) => `${c.name} ${c.organization ?? ""} ${c.email ?? ""}`.toLowerCase().includes(kw))
      : activeList;
    return [...base].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [activeList, query]);

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

  function rebuild() {
    setRebuilding(true);
    router.refresh();
    setTimeout(() => setRebuilding(false), 1500);
  }

  return (
    <div className="grid h-[calc(100vh-53px)] bg-white" style={{ gridTemplateColumns: "minmax(0,290px) minmax(0,460px) 1fr" }}>
      {/* ════════ Colonne 1 — Listes ════════ */}
      <aside className="hidden min-h-0 flex-col border-r md:flex" style={{ background: SIDEBAR_BG, borderColor: LINE }}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: LINE }}>
          <div className="flex items-center gap-2.5 font-extrabold" style={{ color: "var(--text-main)" }}>
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[14px] text-white" style={{ background: RED }}>G</span>
            GEDify Contacts
          </div>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: RED }} aria-label="Réglages">
            <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3.5">
          <div className="flex items-center justify-between px-2 pb-2.5">
            <h2 className="text-[26px] font-extrabold" style={{ color: "var(--text-main)" }}>Listes</h2>
            <button type="button" onClick={rebuild} disabled={rebuilding} className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50" style={{ color: RED }} aria-label="Reconstruire les contacts" title="Synchroniser et reconstruire">
              {rebuilding ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <RefreshCw className="h-[18px] w-[18px]" strokeWidth={1.9} />}
            </button>
          </div>
          {LISTS.map((l) => {
            const active = list === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => { setList(l.key); setSelectedId(null); }}
                className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[15px] transition"
                style={{ background: active ? "var(--accent-soft)" : "transparent", color: "var(--text-main)", fontWeight: active ? 600 : 400 }}
              >
                <span className="w-4 text-center font-bold" style={{ color: RED }}>{l.glyph}</span>
                <span className="flex-1 truncate">{l.label}</span>
                <span className="text-[13px]" style={{ color: HINT }}>{l.count.toLocaleString("fr-FR")}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ════════ Colonne 2 — Liste ════════ */}
      <section className="flex min-h-0 flex-col border-r bg-white" style={{ borderColor: LINE }}>
        <div className="shrink-0 border-b px-3 py-2.5" style={{ borderColor: LINE }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: HINT }} strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un contact…"
              className="h-10 w-full rounded-xl border-0 pl-9 pr-3 text-[15px] outline-none"
              style={{ background: "var(--bg-card-soft)", color: "var(--text-main)" }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center" style={{ color: HINT }}>
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: RED2, color: RED }}>
                <Users className="h-6 w-6" strokeWidth={1.5} />
              </span>
              {list === "all" && !accountConnected ? (
                <>
                  <p className="text-[15px] font-semibold" style={{ color: "var(--text-main)" }}>Boîte mail non connectée</p>
                  <p className="mt-1 max-w-[320px] text-[13px] leading-snug">
                    Les contacts sont construits à partir de vos emails. Connectez (ou reconnectez) votre boîte pour les afficher.
                  </p>
                  <Link href="/emails/connecter?provider=google" className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: RED }}>
                    Connecter une boîte mail
                  </Link>
                </>
              ) : list === "all" && importedLinks === 0 ? (
                <>
                  <p className="text-[15px] font-semibold" style={{ color: "var(--text-main)" }}>Aucune pièce jointe importée en GED</p>
                  <p className="mt-1 max-w-[320px] text-[13px] leading-snug">
                    Un contact apparaît dès qu&apos;un email non masqué a une pièce jointe <strong>importée dans la GED</strong>. Importez des PJ depuis la Messagerie, puis reconstruisez.
                  </p>
                  <button type="button" onClick={rebuild} disabled={rebuilding} className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: RED }}>
                    {rebuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={2} />}
                    Synchroniser et reconstruire
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-semibold" style={{ color: "var(--text-main)" }}>{query ? "Aucun résultat" : "Aucun contact éligible"}</p>
                  <p className="mt-1 max-w-[300px] text-[13px] leading-snug">
                    Les contacts apparaissent lorsqu&apos;ils sont liés à des emails non masqués contenant des pièces jointes importées dans la GED.
                  </p>
                  <button type="button" onClick={rebuild} disabled={rebuilding} className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: RED }}>
                    {rebuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={2} />}
                    Synchroniser et reconstruire
                  </button>
                </>
              )}
            </div>
          ) : (
            groups.map(([letter, rows]) => (
              <div key={letter}>
                <div className="px-3 pb-1 pt-2 text-[13px] font-extrabold" style={{ color: HINT }}>{letter}</div>
                {rows.map((c) => {
                  const active = c.id === effectiveSelected;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition"
                      style={{ background: active ? RED : "transparent", color: active ? "#fff" : "var(--text-main)" }}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: active ? "#fff" : RED2, color: RED }}>
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold leading-tight">{c.name}</span>
                        <span className="block truncate text-[13px]" style={{ color: active ? "var(--accent-soft)" : "var(--text-muted)" }}>
                          {c.organization ?? (c.source === "correspondent" ? "Correspondant GEDify" : c.email ?? "")}
                        </span>
                      </span>
                      {c.source === "email" && (c.linkedGedDocumentsCount ?? 0) > 0 ? (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: active ? "#fff" : RED2, color: RED }}>
                          {c.linkedGedDocumentsCount} doc
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
      <section className={`fixed inset-0 z-50 bg-white md:static md:z-auto md:flex ${selectedId ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>
        <button type="button" onClick={() => setSelectedId(null)} className="flex h-12 shrink-0 items-center gap-1.5 border-b px-4 text-[15px] font-medium md:hidden" style={{ borderColor: LINE, color: RED }}>
          <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Listes
        </button>
        <div className="min-h-0 flex-1">
          <ContactDetailView
            key={selected?.id ?? "none"}
            contact={selected}
            onSaved={(updated) => setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
            onDeleted={(id) => { setItems((prev) => prev.filter((c) => c.id !== id)); setSelectedId(null); }}
            onHideSender={(id) => { setItems((prev) => prev.filter((c) => c.id !== id)); setSelectedId(null); }}
          />
        </div>
      </section>
    </div>
  );
}
