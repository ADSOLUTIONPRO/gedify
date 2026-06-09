"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, EyeOff, FolderPlus, Loader2, Paperclip, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { MailClassifyPanel } from "@/components/messaging/mail-classify-panel";
import { MailReadingPane } from "@/components/messaging/mail-reading-pane";
import { MailFilterAutocomplete, type FilterSuggestion } from "@/components/messaging/mail-filter-autocomplete";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { formatTime, senderEmail, senderName } from "./mail-list-utils";
import type { EmailGedLink, EmailThreadRecord } from "@/lib/messaging/email-types";

/* ── Thème Apple Mail (dominante ROUGE) ─────────────────────────────────── */
const RED = "var(--accent)";
const RED2 = "var(--accent-soft)";
const LINE = "var(--border)";
const MUTED = "var(--text-hint)";

type Thread = EmailThreadRecord;
type AttachSummary = { imported: number; error: boolean; docId: number | null };

type Props = {
  initialThreads: Thread[];
  initialHiddenEmails: string[];
  linksByThread: Map<string, EmailGedLink[]>;
  initialNextPageToken?: string | null;
  attachmentsByThread: Map<string, AttachSummary>;
  query?: string;
  /** Filtre « Boîte mail » courant (id de compte ou null/"all") — propagé aux refetch. */
  accountFilter?: string | null;
  /** Boîtes en erreur de synchronisation (bandeau discret). */
  accountErrors?: { email: string; reconnect: boolean }[];
  accountEmail?: string | null;
  folderLabel: string;
};

/** Étiquette colorée d'une ligne (Non lu / PJ importée / Lié à la GED). */
function rowTag(t: Thread, imported: boolean, hasGed: boolean): string | null {
  if (imported) return "PJ importée";
  if (hasGed) return "Lié à la GED";
  if (t.unread) return "Non lu";
  return null;
}

export function InboxTwoPane({
  initialThreads,
  initialHiddenEmails,
  linksByThread,
  initialNextPageToken,
  attachmentsByThread,
  query = "in:inbox",
  accountFilter = null,
  accountErrors = [],
  accountEmail,
  folderLabel,
}: Props) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [nextPageToken, setNextPageToken] = useState<string | null>(initialNextPageToken ?? null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hiddenEmails] = useState<Set<string>>(new Set(initialHiddenEmails.map((e) => e.toLowerCase())));

  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classifyIds, setClassifyIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  // Multi-sélection + actions groupées
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkHide, setConfirmBulkHide] = useState(false);
  const [hidingBusy, setHidingBusy] = useState(false);
  // Filtres avancés serveur (raffinent la requête Gmail).
  const [filters, setFilters] = useState<{ key: string; label: string; gmail: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const baseThreads = useMemo(
    () => threads.filter((t) => !hiddenEmails.has(senderEmail(t).toLowerCase())),
    [threads, hiddenEmails],
  );

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return baseThreads;
    return baseThreads.filter((t) =>
      `${senderName(t)} ${senderEmail(t)} ${t.subject ?? ""} ${t.snippet ?? ""}`.toLowerCase().includes(kw),
    );
  }, [baseThreads, keyword]);

  const effectiveSelected = useMemo(() => {
    if (selectedId && visible.some((t) => t.id === selectedId)) return selectedId;
    return visible[0]?.id ?? null;
  }, [visible, selectedId]);

  // Thread sélectionné + détection multi-comptes (badge source par ligne).
  const selectedThread = useMemo(() => visible.find((t) => t.id === effectiveSelected) ?? null, [visible, effectiveSelected]);
  const multiAccount = useMemo(() => new Set(threads.map((t) => t.accountEmail).filter(Boolean)).size > 1, [threads]);

  const effectiveQuery = useMemo(
    () => [query, ...filters.map((f) => f.gmail)].join(" ").trim() || query,
    [query, filters],
  );

  async function fetchThreads(q: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "50" });
      if (accountFilter) params.set("accountId", accountFilter);
      const res = await fetch(`/api/messaging/gmail/threads?${params.toString()}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { threads?: Thread[]; nextPageToken?: string | null };
      if (Array.isArray(data.threads)) {
        setThreads(data.threads);
        setNextPageToken(data.nextPageToken ?? null);
        setSelected(new Set());
      }
    } catch {
      /* on garde la liste courante */
    } finally {
      setLoading(false);
    }
  }
  function refresh() { void fetchThreads(effectiveQuery); }

  // Refetch quand les filtres changent (skip premier rendu = threads SSR).
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    void fetchThreads(effectiveQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveQuery]);

  function addFilter(f: { key: string; label: string; gmail: string }) {
    setFilters((prev) => (prev.some((x) => x.key === f.key) ? prev : [...prev, f]));
  }
  function removeFilter(key: string) {
    setFilters((prev) => prev.filter((f) => f.key !== key));
  }

  async function loadMore() {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ q: effectiveQuery, limit: "25", pageToken: nextPageToken });
      if (accountFilter) params.set("accountId", accountFilter);
      const res = await fetch(`/api/messaging/gmail/threads?${params.toString()}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { threads?: Thread[]; nextPageToken?: string | null };
      if (Array.isArray(data.threads)) {
        setThreads((prev) => {
          const seen = new Set(prev.map((t) => t.id));
          return [...prev, ...data.threads!.filter((t) => !seen.has(t.id))];
        });
      }
      setNextPageToken(data.nextPageToken ?? null);
    } catch {
      /* idem */
    } finally {
      setLoadingMore(false);
    }
  }

  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 4000);
  }

  // Action sur un fil (archiver / corbeille / lu / non lu). Archiver et corbeille
  // retirent le fil de la liste de façon optimiste et libèrent le volet de lecture.
  async function threadAction(id: string, action: "archive" | "trash" | "markRead" | "markUnread", toastMsg?: string) {
    const removeFromList = action === "archive" || action === "trash";
    if (removeFromList) {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      setSelected((p) => { const n = new Set(p); n.delete(id); return n; });
      if (selectedId === id) setSelectedId(null);
    }
    try {
      const acc = threads.find((t) => t.id === id)?.accountId;
      const res = await fetch(`/api/messaging/gmail/threads/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, accountId: acc }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (toastMsg) showToast(toastMsg);
    } catch {
      showToast("Action impossible. Réessayez.");
      if (removeFromList) void refresh();
    }
  }

  // ── Multi-sélection ──
  const anySelected = selected.size > 0;
  const allSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  function toggleSelect(id: string) {
    setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(() => (allSelected ? new Set<string>() : new Set(visible.map((t) => t.id))));
  }
  function clearSel() { setSelected(new Set()); }
  async function bulkHide() {
    const senders = visible
      .filter((t) => selected.has(t.id))
      .map((t) => ({ email: senderEmail(t), displayName: senderName(t) }))
      .filter((s) => s.email);
    if (!senders.length) return;
    setHidingBusy(true);
    try {
      await fetch("/api/messaging/hidden-senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bulk: senders }),
      });
      showToast(`${senders.length} expéditeur(s) masqué(s)`);
      clearSel();
      void refresh();
    } finally {
      setHidingBusy(false);
      setConfirmBulkHide(false);
    }
  }

  // Infinite scroll : charge automatiquement le lot suivant quand le bas approche.
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextPageToken) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting && !loadingMore) void loadMore(); },
      { root: scrollRef.current, rootMargin: "300px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPageToken, loadingMore, visible.length]);

  return (
    <div className="grid h-full min-h-0" style={{ gridTemplateColumns: "minmax(0,470px) 1fr" }}>
      {/* ════════ Colonne 2 — Liste des messages ════════ */}
      <div className="flex min-h-0 flex-col border-r bg-white" style={{ borderColor: LINE }}>
        {/* Recherche + filtres avancés */}
        <div className="shrink-0 border-b px-3 py-2" style={{ borderColor: LINE }}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: MUTED }} strokeWidth={1.75} />
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Rechercher"
                className="h-10 w-full rounded-xl border-0 pl-9 pr-3 text-[15px] outline-none"
                style={{ background: "var(--bg-card-soft)", color: "var(--text-main)" }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition hover:bg-[var(--accent-soft)]"
              style={{ borderColor: "var(--border)", color: showFilters || filters.length ? "var(--accent)" : "var(--text-muted)" }}
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.85} /> Filtres{filters.length ? ` (${filters.length})` : ""}
            </button>
          </div>

          {showFilters ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <MailFilterAutocomplete endpoint="/api/mail/filters/senders" placeholder="Expéditeur…" onSelect={(it: FilterSuggestion) => it.email && addFilter({ key: `from:${it.email}`, label: `De : ${it.name ?? it.email}`, gmail: `from:${it.email}` })} />
              <MailFilterAutocomplete endpoint="/api/mail/filters/recipients" placeholder="Destinataire…" onSelect={(it: FilterSuggestion) => it.email && addFilter({ key: `to:${it.email}`, label: `À : ${it.name ?? it.email}`, gmail: `to:${it.email}` })} />
              <MailFilterAutocomplete endpoint="/api/mail/filters/labels" placeholder="Label / dossier d'origine…" onSelect={(it: FilterSuggestion) => it.name && addFilter({ key: `label:${it.name}`, label: `Label : ${it.name}`, gmail: `label:"${it.name}"` })} />
              <button type="button" onClick={() => addFilter({ key: "att", label: "Avec pièce jointe", gmail: "has:attachment" })} className="flex h-8 items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-semibold transition hover:bg-[var(--accent-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                <Paperclip className="h-3.5 w-3.5" strokeWidth={1.85} /> Avec pièce jointe
              </button>
            </div>
          ) : null}

          {filters.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <span key={f.key} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {f.label}
                  <button type="button" onClick={() => removeFilter(f.key)} aria-label="Retirer le filtre"><X className="h-3 w-3" strokeWidth={2.5} /></button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Titre du dossier + nombre + tout sélectionner */}
        <div className="flex shrink-0 items-end justify-between border-b px-4 py-2.5" style={{ borderColor: LINE }}>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              title="Tout sélectionner"
              aria-label="Tout sélectionner"
              className="h-4 w-4 rounded"
              style={{ accentColor: "var(--accent)" }}
            />
            <div>
              <h1 className="text-[26px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>{folderLabel}</h1>
              <p className="text-[13px]" style={{ color: MUTED }}>{visible.length} message{visible.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-[var(--accent-soft)] disabled:opacity-40"
            style={{ color: RED }}
            title="Actualiser"
          >
            {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <RefreshCw className="h-[18px] w-[18px]" strokeWidth={1.85} />}
          </button>
        </div>

        {/* Avertissement par compte (l'agrégat reste affiché pour les autres). */}
        {accountErrors.length > 0 ? (
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-[12px]" style={{ borderColor: LINE, background: "#FFF7ED", color: "#9A3412" }} role="status">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">
              {accountErrors.length === 1
                ? `1 boîte n'a pas pu être synchronisée (${accountErrors[0].email})${accountErrors[0].reconnect ? " — reconnexion requise" : ""}.`
                : `${accountErrors.length} boîtes n'ont pas pu être synchronisées : ${accountErrors.map((e) => e.email).join(", ")}.`}
            </span>
          </div>
        ) : null}

        {/* Barre d'actions groupées */}
        {anySelected ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: LINE, background: "var(--accent-soft)" }}>
            <span className="text-[12.5px] font-bold" style={{ color: "var(--accent)" }}>{selected.size} sélectionné(s)</span>
            <button type="button" onClick={() => setClassifyIds([...selected])} className="inline-flex h-7 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12px] font-semibold transition hover:opacity-90" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.85} /> Associer à un dossier
            </button>
            <button type="button" onClick={() => setConfirmBulkHide(true)} disabled={hidingBusy} className="inline-flex h-7 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.85} /> Masquer les expéditeurs
            </button>
            <button type="button" onClick={clearSel} className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white" style={{ color: "var(--text-muted)" }} aria-label="Désélectionner">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : null}

        {/* Liste */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center" style={{ color: MUTED }}>
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: RED2, color: RED }}>
                <Search className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <p className="text-[16px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun e-mail</p>
              <p className="mt-1 text-[13px]">{keyword ? "Aucun résultat pour cette recherche." : "Cette boîte est vide."}</p>
            </div>
          ) : (
            <ul>
              {visible.map((t) => {
                const active = t.id === effectiveSelected;
                const sel = selected.has(t.id);
                const name = senderName(t);
                const hasGed = (linksByThread.get(t.id) ?? []).length > 0;
                const imported = (attachmentsByThread.get(t.id)?.imported ?? 0) > 0;
                const tag = rowTag(t, imported, hasGed);
                return (
                  <li
                    key={`${t.accountId}:${t.id}`}
                    className="group flex items-stretch border-b"
                    style={{ borderColor: "var(--border-soft)", background: active ? "var(--accent-soft)" : sel ? "var(--bg-card-soft)" : undefined }}
                  >
                    <label className={`flex w-9 shrink-0 cursor-pointer items-center justify-center ${anySelected || sel ? "" : "opacity-0 transition group-hover:opacity-100"}`}>
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggleSelect(t.id)}
                        className="h-4 w-4 rounded"
                        style={{ accentColor: "var(--accent)" }}
                        aria-label={`Sélectionner ${name}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className="grid min-w-0 flex-1 grid-cols-[10px_1fr_auto] gap-2.5 py-3 pr-3.5 text-left transition hover:bg-[var(--bg-card-soft)]"
                    >
                      <span className="mt-1.5 h-2 w-2 rounded-full" style={{ background: t.unread ? RED : "transparent" }} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px]" style={{ color: "var(--text-main)", fontWeight: t.unread ? 750 : 600 }}>
                          {name}
                        </span>
                        <span className="mt-0.5 block truncate text-[14px]" style={{ color: "var(--text-main)", fontWeight: t.unread ? 650 : 450 }}>
                          {t.subject ?? "(sans sujet)"}
                        </span>
                        <span className="mt-0.5 block truncate text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                          {t.snippet ?? ""}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {multiAccount && t.accountEmail ? (
                            <span className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[10.5px] font-bold" style={{ borderColor: LINE, color: "var(--text-muted)", background: "var(--bg-card-soft)" }} title={`Boîte : ${t.accountEmail}`}>
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: RED }} aria-hidden="true" />
                              <span className="truncate">{t.accountEmail}</span>
                            </span>
                          ) : null}
                          {tag ? (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: RED2, color: "var(--accent)" }}>
                              {tag}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px]" style={{ color: MUTED }}>{formatTime(t.lastMessageAt)}</span>
                    </button>
                  </li>
                );
              })}
              <li ref={sentinelRef} aria-hidden="true" className="h-px" />
              <li className="flex justify-center py-4">
                {nextPageToken ? (
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="inline-flex h-9 items-center gap-2 rounded-full border px-5 text-[13px] font-bold transition hover:bg-[var(--accent-soft)] disabled:opacity-50"
                    style={{ borderColor: LINE, color: RED }}
                  >
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loadingMore ? "Chargement…" : "Charger plus"}
                  </button>
                ) : (
                  <span className="text-[12px]" style={{ color: MUTED }}>Tous les courriels sont affichés.</span>
                )}
              </li>
            </ul>
          )}
        </div>

        {/* Pied : compte */}
        {accountEmail ? (
          <div className="flex items-center gap-2 border-t px-4 py-2 text-[12px]" style={{ borderColor: LINE, color: MUTED }}>
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{accountEmail}</span>
          </div>
        ) : null}
      </div>

      {/* ════════ Colonne 3 — Lecture ════════ */}
      <div className="min-h-0">
        <MailReadingPane
          threadId={effectiveSelected}
          accountId={selectedThread?.accountId ?? null}
          folderLabel={folderLabel}
          onClassify={(id) => setClassifyIds([id])}
          onArchive={(id) => void threadAction(id, "archive", "Conversation archivée")}
          onTrash={(id) => void threadAction(id, "trash", "Conversation déplacée dans la corbeille")}
          onMarkUnread={(id) => void threadAction(id, "markUnread", "Marqué comme non lu")}
        />
      </div>

      {classifyIds.length > 0 && (
        <MailClassifyPanel
          threadIds={classifyIds}
          onClose={() => setClassifyIds([])}
          onSuccess={(n, folder) => {
            setClassifyIds([]);
            clearSel();
            showToast(`${n} mail${n > 1 ? "s" : ""} classé${n > 1 ? "s" : ""} dans « ${folder} »`);
          }}
        />
      )}

      <ConfirmActionDialog
        isOpen={confirmBulkHide}
        onClose={() => setConfirmBulkHide(false)}
        onConfirm={() => void bulkHide()}
        variant="warning"
        title={`Masquer ${selected.size} expéditeur(s) ?`}
        description="Ces expéditeurs seront cachés dans GEDify (Courriels à traiter). Les emails restent intacts chez le fournisseur."
        confirmLabel="Masquer"
        loading={hidingBusy}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-2xl px-4 py-3 text-[13px] font-semibold text-white shadow-xl" style={{ background: RED }} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
