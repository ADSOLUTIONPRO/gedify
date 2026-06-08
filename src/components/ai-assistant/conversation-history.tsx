"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Check, Clock, MessageSquare, Pencil, Search, Trash2, X } from "lucide-react";
import type { ConversationSummary } from "@/lib/assistant/use-conversations";

/* Liste d'historique des conversations IA : recherche, groupes par date,
   ouverture, renommage en ligne, archivage et suppression (avec confirmation). */

function groupOf(iso: string | null, ref: number): "today" | "week" | "older" {
  if (!iso) return "older";
  const t = new Date(iso).getTime();
  const days = (ref - t) / 86_400_000;
  if (days < 1) return "today";
  if (days < 7) return "week";
  return "older";
}

const GROUP_LABEL: Record<string, string> = { today: "Aujourd'hui", week: "7 derniers jours", older: "Plus ancien" };

export function ConversationHistory({
  conversations,
  activeId,
  onOpen,
  onRename,
  onArchive,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Instant de référence figé au montage (groupage relatif aujourd'hui/semaine).
  const [now] = useState(() => Date.now());

  const groups = useMemo(() => {
    const ref = now;
    const q = query.trim().toLowerCase();
    const filtered = conversations.filter((c) => !q || c.title.toLowerCase().includes(q) || (c.lastMessagePreview ?? "").toLowerCase().includes(q));
    const buckets: Record<string, ConversationSummary[]> = { today: [], week: [], older: [] };
    for (const c of filtered) buckets[groupOf(c.lastMessageAt ?? c.updatedAt, ref)].push(c);
    return (["today", "week", "older"] as const).map((k) => ({ key: k, label: GROUP_LABEL[k], items: buckets[k] })).filter((g) => g.items.length > 0);
  }, [conversations, query, now]);

  function startRename(c: ConversationSummary) {
    setEditingId(c.id);
    setDraft(c.title);
  }
  function commitRename() {
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-2.5" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex items-center gap-2 rounded-xl border px-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-hint)" }} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une conversation…"
            className="h-9 w-full bg-transparent text-[13px] outline-none"
            style={{ color: "var(--text-main)" }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Aucune conversation enregistrée pour l&apos;instant.
          </p>
        ) : groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucun résultat.</p>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="mb-2">
              <p className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((c) => {
                  const isActive = c.id === activeId;
                  const isEditing = c.id === editingId;
                  return (
                    <li
                      key={c.id}
                      className="group rounded-xl px-2 py-1.5 transition"
                      style={{ background: isActive ? "var(--accent-soft)" : "transparent" }}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                            className="h-8 w-full rounded-lg border bg-white px-2 text-[13px] outline-none"
                            style={{ borderColor: "var(--accent)", color: "var(--text-main)" }}
                          />
                          <button type="button" onClick={commitRename} aria-label="Valider" className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: "var(--gedify-green)" }}>
                            <Check className="h-4 w-4" strokeWidth={2.25} />
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} aria-label="Annuler" className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: "var(--text-muted)" }}>
                            <X className="h-4 w-4" strokeWidth={2.25} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => onOpen(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                            <MessageSquare className="h-4 w-4 shrink-0" style={{ color: isActive ? "var(--accent)" : "var(--text-hint)" }} strokeWidth={1.85} aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>
                                {c.title}
                                {c.status === "archived" ? <span className="ml-1 text-[10px] font-normal" style={{ color: "var(--text-hint)" }}>(archivée)</span> : null}
                              </span>
                              {c.lastMessagePreview ? (
                                <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{c.lastMessagePreview}</span>
                              ) : null}
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                            <button type="button" onClick={() => startRename(c)} aria-label="Renommer" title="Renommer" className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white" style={{ color: "var(--text-muted)" }}>
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.85} />
                            </button>
                            <button type="button" onClick={() => onArchive(c.id, c.status !== "archived")} aria-label={c.status === "archived" ? "Désarchiver" : "Archiver"} title={c.status === "archived" ? "Désarchiver" : "Archiver"} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white" style={{ color: "var(--text-muted)" }}>
                              {c.status === "archived" ? <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.85} /> : <Archive className="h-3.5 w-3.5" strokeWidth={1.85} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm(`Supprimer la conversation « ${c.title} » ? Cette action est définitive.`)) onDelete(c.id); }}
                              aria-label="Supprimer"
                              title="Supprimer"
                              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white"
                              style={{ color: "var(--danger)" }}
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.85} />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="mt-0.5 flex items-center gap-1 pl-6 text-[10.5px]" style={{ color: "var(--text-hint)" }}>
                        <Clock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                        {new Date(c.lastMessageAt ?? c.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        <span aria-hidden="true">·</span>
                        {c.messageCount} message{c.messageCount > 1 ? "s" : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
