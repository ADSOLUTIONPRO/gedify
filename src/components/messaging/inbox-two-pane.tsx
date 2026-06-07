"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { MailClassifyPanel } from "@/components/messaging/mail-classify-panel";
import { MailReadingPane } from "@/components/messaging/mail-reading-pane";
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
  const [classifyId, setClassifyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: "50" });
      const res = await fetch(`/api/messaging/gmail/threads?${params.toString()}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { threads?: Thread[]; nextPageToken?: string | null };
      if (Array.isArray(data.threads)) {
        setThreads(data.threads);
        setNextPageToken(data.nextPageToken ?? null);
      }
    } catch {
      /* on garde la liste courante */
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ q: query, limit: "25", pageToken: nextPageToken });
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
        {/* Recherche */}
        <div className="shrink-0 border-b px-3 py-2" style={{ borderColor: LINE }}>
          <div className="relative">
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
        </div>

        {/* Titre du dossier + nombre */}
        <div className="flex shrink-0 items-end justify-between border-b px-4 py-2.5" style={{ borderColor: LINE }}>
          <div>
            <h1 className="text-[26px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>{folderLabel}</h1>
            <p className="text-[13px]" style={{ color: MUTED }}>{visible.length} message{visible.length > 1 ? "s" : ""}</p>
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
                const name = senderName(t);
                const hasGed = (linksByThread.get(t.id) ?? []).length > 0;
                const imported = (attachmentsByThread.get(t.id)?.imported ?? 0) > 0;
                const tag = rowTag(t, imported, hasGed);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className="grid w-full grid-cols-[10px_1fr_auto] gap-2.5 border-b px-3.5 py-3 text-left transition hover:bg-[var(--bg-card-soft)]"
                      style={{ borderColor: "var(--border-soft)", background: active ? "var(--accent-soft)" : undefined }}
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
                        {tag ? (
                          <span className="mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: RED2, color: "var(--accent)" }}>
                            {tag}
                          </span>
                        ) : null}
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
        <MailReadingPane threadId={effectiveSelected} folderLabel={folderLabel} onClassify={(id) => setClassifyId(id)} />
      </div>

      {classifyId && (
        <MailClassifyPanel
          threadIds={[classifyId]}
          onClose={() => setClassifyId(null)}
          onSuccess={(n, folder) => {
            setClassifyId(null);
            showToast(`${n} mail${n > 1 ? "s" : ""} classé${n > 1 ? "s" : ""} dans « ${folder} »`);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-2xl px-4 py-3 text-[13px] font-semibold text-white shadow-xl" style={{ background: RED }} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
