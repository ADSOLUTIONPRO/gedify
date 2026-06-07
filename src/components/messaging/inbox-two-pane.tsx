"use client";

import { useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { MailClassifyPanel } from "@/components/messaging/mail-classify-panel";
import { MailReadingPane } from "@/components/messaging/mail-reading-pane";
import { avatarColor, formatTime, initials, senderEmail, senderName } from "./mail-list-utils";
import type { EmailGedLink, EmailThreadRecord } from "@/lib/messaging/email-types";

type Thread = EmailThreadRecord;
type AttachSummary = { imported: number; error: boolean; docId: number | null };

type ChipKey = "all" | "unread" | "attachments" | "starred";

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

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "unread", label: "Non lus" },
  { key: "attachments", label: "Avec PJ" },
  { key: "starred", label: "Suivis" },
];

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

  const [chip, setChip] = useState<ChipKey>("all");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classifyId, setClassifyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Threads visibles (hors expéditeurs masqués).
  const baseThreads = useMemo(
    () => threads.filter((t) => !hiddenEmails.has(senderEmail(t).toLowerCase())),
    [threads, hiddenEmails],
  );

  const counts = useMemo(
    () => ({
      all: baseThreads.length,
      unread: baseThreads.filter((t) => t.unread).length,
      attachments: baseThreads.filter((t) => t.hasAttachments || t.attachmentCount > 0).length,
      starred: baseThreads.filter((t) => t.important).length,
    }),
    [baseThreads],
  );

  // Filtre chip + recherche (côté client, instantané).
  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return baseThreads.filter((t) => {
      if (chip === "unread" && !t.unread) return false;
      if (chip === "attachments" && !(t.hasAttachments || t.attachmentCount > 0)) return false;
      if (chip === "starred" && !t.important) return false;
      if (kw) {
        const hay = `${senderName(t)} ${senderEmail(t)} ${t.subject ?? ""} ${t.snippet ?? ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [baseThreads, chip, keyword]);

  // Sélection effective : le choix de l'utilisateur s'il est encore visible,
  // sinon le 1er message (sélection auto, sans effet → pas de setState en effect).
  const effectiveSelected = useMemo(() => {
    if (selectedId && visible.some((t) => t.id === selectedId)) return selectedId;
    return visible[0]?.id ?? null;
  }, [visible, selectedId]);

  const buildBase = () => query;

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: buildBase(), limit: "50" });
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
      const params = new URLSearchParams({ q: buildBase(), limit: "25", pageToken: nextPageToken });
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

  return (
    <div className="grid h-full min-h-0" style={{ gridTemplateColumns: "minmax(320px, 400px) 1fr" }}>
      {/* ════════ Volet liste ════════ */}
      <div className="flex min-h-0 flex-col border-r bg-white" style={{ borderColor: "var(--border)" }}>
        {/* Recherche */}
        <div className="border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Rechercher dans les mails…"
              className="h-9 w-full rounded-xl border pl-9 pr-3 text-[13px] outline-none transition focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
            />
          </div>
        </div>

        {/* Chips + pagination */}
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
          {CHIPS.map((c) => {
            const active = chip === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setChip(c.key)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${active ? "color-mix(in srgb, var(--accent) 35%, white)" : "var(--border)"}`,
                }}
              >
                {c.label}
                {c.key === "unread" && counts.unread > 0 ? (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                ) : null}
                <span style={{ color: active ? "var(--accent)" : "var(--text-hint)" }}>{counts[c.key]}</span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              title="Actualiser"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)] disabled:opacity-40"
              style={{ color: "var(--text-muted)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.75} />}
            </button>
            <span className="text-[11.5px] tabular-nums" style={{ color: "var(--text-hint)" }}>
              1–{visible.length}{nextPageToken ? "+" : ""}
            </span>
            <button type="button" disabled title="Précédent" className="flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-30" style={{ color: "var(--text-muted)" }}>
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={!nextPageToken || loadingMore}
              title="Charger la suite"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)] disabled:opacity-30"
              style={{ color: "var(--text-muted)" }}
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" strokeWidth={2} />}
            </button>
          </div>
        </div>

        {/* Liste */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center" style={{ color: "var(--text-hint)" }}>
              <Mail className="mb-2 h-9 w-9" strokeWidth={1.25} />
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>
                {keyword || chip !== "all" ? "Aucun résultat" : "Boîte vide"}
              </p>
            </div>
          ) : (
            <ul>
              {visible.map((t) => {
                const isSelected = t.id === effectiveSelected;
                const name = senderName(t);
                const color = avatarColor(name);
                const hasGed = (linksByThread.get(t.id) ?? []).length > 0;
                const att = attachmentsByThread.get(t.id);
                const imported = (att?.imported ?? 0) > 0;
                const hasAtt = t.hasAttachments || t.attachmentCount > 0 || imported;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className="flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition"
                      style={{
                        borderColor: "var(--border-soft)",
                        borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                        background: isSelected ? "var(--accent-soft)" : t.unread ? "var(--surface)" : "var(--bg-card-soft)",
                      }}
                    >
                      {/* Pastille non-lu */}
                      <span className="mt-3.5 h-2 w-2 shrink-0 rounded-full" style={{ background: t.unread ? "var(--accent)" : "transparent" }} />

                      {/* Avatar */}
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold text-white" style={{ background: color }}>
                        {initials(name)}
                      </span>

                      {/* Contenu */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px]" style={{ color: "var(--text-main)", fontWeight: t.unread ? 700 : 600 }}>
                            {name}
                          </span>
                          <span className="shrink-0 text-[11px]" style={{ color: t.unread ? "var(--accent)" : "var(--text-hint)", fontWeight: t.unread ? 700 : 400 }}>
                            {formatTime(t.lastMessageAt)}
                          </span>
                        </div>
                        <p className="truncate text-[12.5px]" style={{ color: "var(--text-main)", fontWeight: t.unread ? 600 : 400 }}>
                          {t.subject ?? "(sans sujet)"}
                        </p>
                        <p className="truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                          {t.snippet ?? ""}
                        </p>
                        {(hasAtt || hasGed) && (
                          <div className="mt-1 flex items-center gap-1.5">
                            {hasAtt && (
                              <span
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                                style={imported
                                  ? { background: "var(--gedify-green-soft)", color: "#15803D" }
                                  : { background: "#EDE9FE", color: "#6D28D9" }}
                              >
                                <Paperclip className="h-2.5 w-2.5" strokeWidth={2.5} />
                                {imported ? "PJ importées" : "PJ"}
                              </span>
                            )}
                            {hasGed && (
                              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                                GED
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Étoile (suivi) */}
                      {t.important ? (
                        <Star className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#FBBC04" }} fill="#FBBC04" strokeWidth={1.75} />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pied : compte */}
        {accountEmail ? (
          <div className="flex items-center gap-2 border-t px-3 py-2 text-[11.5px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{accountEmail}</span>
          </div>
        ) : null}
      </div>

      {/* ════════ Volet lecture ════════ */}
      <div className="min-h-0">
        <MailReadingPane threadId={effectiveSelected} folderLabel={folderLabel} onClassify={(id) => setClassifyId(id)} />
      </div>

      {/* Panneau Classer / Associer */}
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
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-2xl px-4 py-3 text-[13px] font-semibold text-white shadow-xl" style={{ background: "var(--accent)" }} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
