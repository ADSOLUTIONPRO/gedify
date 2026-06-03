"use client";

import { useEffect, useRef, useReducer, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  EyeOff,
  FileUp,
  FolderPlus,
  Loader2,
  Mail,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { MailClassifyPanel } from "@/components/messaging/mail-classify-panel";
import type { EmailGedLink, EmailThreadRecord } from "@/lib/messaging/email-types";
import type { CorrespondentFilter } from "@/lib/messaging/correspondent-filters";

type Thread = EmailThreadRecord;
type LinksByThread = Map<string, EmailGedLink[]>;
type AttachSummary = { imported: number; error: boolean; docId: number | null };

type InboxClientProps = {
  initialThreads: Thread[];
  initialHiddenEmails: string[];
  linksByThread: LinksByThread;
  initialNextPageToken?: string | null;
  attachmentsByThread: Map<string, AttachSummary>;
  /** Requête Gmail de base du dossier courant (in:inbox, in:sent, in:trash…). */
  query?: string;
  /** Correspondants GED (avec emails) pour le filtre « Correspondant ». */
  correspondents?: CorrespondentFilter[];
};

/**
 * État d'import des pièces jointes d'un thread → badge de ligne (#5).
 * Piloté par la surcouche GED (`mail-document-links-store`) : on signale surtout
 * les PJ déjà importées dans la GED (pour ne pas re-proposer l'import).
 * NB : la détection « a des PJ non importées » au niveau liste est limitée
 * (threads chargés en format Gmail `metadata` → attachmentCount = 0).
 */
function attachmentBadge(total: number, s: AttachSummary | undefined): { label: string; bg: string; color: string } | null {
  const imported = s?.imported ?? 0;
  const error = s?.error ?? false;
  if (total <= 0 && imported === 0 && !error) return null; // rien à signaler
  if (imported === 0 && error) return { label: "Erreur PJ", bg: "#FEE2E2", color: "#B91C1C" };
  if (imported === 0) return { label: "PJ non importées", bg: "#FEF3C7", color: "#B45309" };
  if (total > imported) return { label: "Import partiel", bg: "#FEF3C7", color: "#B45309" };
  return { label: "PJ importées", bg: "#DCFCE7", color: "#15803D" };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function senderEmail(t: Thread): string {
  return t.participants[0]?.email ?? "";
}

function senderName(t: Thread): string {
  const p = t.participants[0];
  if (!p) return "(inconnu)";
  return p.name ?? p.email;
}

/** Couleur déterministe basée sur les initiales */
const AVATAR_COLORS = [
  "#4285F4", "#EA4335", "#FBBC04", "#34A853",
  "#FF6D00", "#46BDC6", "#7B61FF", "#E91E63",
  "#009688", "#795548",
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function buildQuery(base: string, keyword: string, sender: string, hasAttachment: boolean, corrEmails: string[] = []): string {
  const parts = [base];
  if (sender.trim()) parts.push(`from:${sender.trim()}`);
  if (hasAttachment) parts.push("has:attachment");
  if (corrEmails.length) parts.push(`(${corrEmails.flatMap((e) => [`from:${e}`, `to:${e}`]).join(" OR ")})`);
  if (keyword.trim()) parts.push(keyword.trim());
  return parts.join(" ");
}

// ── Composant principal ───────────────────────────────────────────────────────

export function InboxClient({
  initialThreads,
  initialHiddenEmails,
  linksByThread,
  initialNextPageToken,
  attachmentsByThread,
  query = "in:inbox",
  correspondents = [],
}: InboxClientProps) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [nextPageToken, setNextPageToken] = useState<string | null>(initialNextPageToken ?? null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hiddenEmails, setHiddenEmails] = useState<Set<string>>(
    new Set(initialHiddenEmails.map((e) => e.toLowerCase())),
  );

  // Recherche
  const [keyword, setKeyword] = useState("");
  const [sender, setSender] = useState("");
  const [hasAttachment, setHasAttachment] = useState(false);
  const [corrId, setCorrId] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [hidingBusy, setHidingBusy] = useState(false);
  const [confirmBulkHide, setConfirmBulkHide] = useState(false);
  const [contextId, setContextId] = useState<string | null>(null);
  const [showClassify, setShowClassify] = useState(false);
  const [classifyToast, setClassifyToast] = useState<string | null>(null);

  const [, reload] = useReducer((n: number) => n + 1, 0);

  const visibleThreads = threads.filter(
    (t) => !hiddenEmails.has(senderEmail(t).toLowerCase()),
  );
  const bulk = useBulkSelect(visibleThreads, (t) => t.id);
  const corrEmails = correspondents.find((c) => String(c.id) === corrId)?.emails ?? [];
  const hasActiveSearch = keyword.trim() || sender.trim() || hasAttachment || Boolean(corrId);

  // Fetch debounce
  async function fetchThreads(q: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "50" });
      const res = await fetch(`/api/messaging/gmail/threads?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { threads?: Thread[]; nextPageToken?: string | null };
      if (Array.isArray(data.threads)) {
        setThreads(data.threads);
        setNextPageToken(data.nextPageToken ?? null);
        bulk.clearAll();
      }
    } finally {
      setLoading(false);
    }
  }

  /** « Voir plus » : charge la page suivante et l'ajoute sous la liste (sans remplacer). */
  async function loadMore() {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        q: buildQuery(query, keyword, sender, hasAttachment, corrEmails),
        limit: "25",
        pageToken: nextPageToken,
      });
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
      /* on garde la liste courante */
    } finally {
      setLoadingMore(false);
    }
  }

  // On garde la liste rendue côté serveur au montage (badges PJ, liens GED…) ;
  // on ne re-fetch que lorsqu'un filtre change réellement.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchThreads(buildQuery(query, keyword, sender, hasAttachment, corrEmails));
    }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, sender, hasAttachment, corrId]);

  async function hideSenderFn(email: string, name: string | null) {
    setHidingBusy(true);
    try {
      await fetch("/api/messaging/hidden-senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, displayName: name }),
      });
      setHiddenEmails((prev) => new Set([...prev, email.toLowerCase()]));
    } finally {
      setHidingBusy(false);
      setContextId(null);
    }
  }

  async function bulkHide() {
    const senders = visibleThreads
      .filter((t) => bulk.isSelected(t.id))
      .map((t) => ({ email: senderEmail(t), displayName: t.participants[0]?.name ?? null }))
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
      const emails = new Set(senders.map((s) => s.email.toLowerCase()));
      setHiddenEmails((prev) => new Set([...prev, ...emails]));
      bulk.clearAll();
    } finally {
      setHidingBusy(false);
      setConfirmBulkHide(false);
    }
  }

  void reload; // utilisé par debounce

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">

      {/* ── Barre d'actions style Twake ── */}
      <div
        className="flex items-center gap-0.5 border-b px-4 py-2.5"
        style={{ borderColor: "#E5E7EB", background: "#fff" }}
      >
        {/* Refresh */}
        <button
          type="button"
          onClick={() => void fetchThreads(buildQuery(query, keyword, sender, hasAttachment, corrEmails))}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100 disabled:opacity-40"
          style={{ color: "#6B7280" }}
          title="Actualiser"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.75} />}
        </button>

        <div className="mx-1 h-4 w-px" style={{ background: "#E5E7EB" }} />

        {/* Select all */}
        <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-medium transition hover:bg-gray-100" style={{ color: "#374151" }}>
          <input
            type="checkbox"
            checked={bulk.isAllSelected}
            onChange={() => bulk.toggleAll()}
            className="h-3.5 w-3.5 rounded"
          />
          Tout sélectionner
        </label>

        {/* Get messages */}
        <button
          type="button"
          onClick={() => void fetchThreads(buildQuery(query, keyword, sender, hasAttachment, corrEmails))}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition hover:bg-gray-100"
          style={{ color: "#374151" }}
        >
          <Mail className="h-4 w-4" strokeWidth={1.75} />
          Récupérer les messages
        </button>

        {/* Mark all as read */}
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition hover:bg-gray-100"
          style={{ color: "#374151" }}
        >
          <Mail className="h-4 w-4" strokeWidth={1.75} />
          Tout marquer comme lu
        </button>

        {/* Filter */}
        <button
          type="button"
          onClick={() => setShowSearch((v) => !v)}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition hover:bg-gray-100"
          style={{ color: showSearch ? "#F75C8D" : "#374151" }}
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
          Filtrer les messages
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        {/* Actions groupées si sélection */}
        {bulk.selectedCount > 0 && (
          <>
            <div className="mx-1 h-4 w-px" style={{ background: "#E5E7EB" }} />
            <span className="text-[12.5px] font-bold" style={{ color: "#F75C8D" }}>
              {bulk.selectedCount} sélectionné(s)
            </span>
            <button
              type="button"
              onClick={() => setShowClassify(true)}
              className="ml-1 flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition hover:bg-[#FCFAF7]"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
              Ajouter à un dossier
            </button>
            <button
              type="button"
              onClick={() => setConfirmBulkHide(true)}
              disabled={hidingBusy}
              className="ml-1 flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition hover:bg-amber-50 disabled:opacity-40"
              style={{ borderColor: "#FDE68A", color: "#D97706" }}
            >
              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
              Masquer expéditeurs
            </button>
            <button
              type="button"
              onClick={() => bulk.clearAll()}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-gray-100"
              style={{ color: "#9CA3AF" }}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </>
        )}

        {/* Recherche à droite */}
        <div className="ml-auto flex items-center gap-2">
          {hasActiveSearch && (
            <button
              type="button"
              onClick={() => { setKeyword(""); setSender(""); setHasAttachment(false); }}
              className="flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-medium transition hover:bg-gray-50"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
            >
              <X className="h-3 w-3" strokeWidth={2} /> Réinitialiser
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100"
            style={{ color: showSearch ? "#F75C8D" : "#9CA3AF" }}
          >
            <Search className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── Barre de recherche dépliable ── */}
      {showSearch && (
        <div
          className="flex flex-wrap items-center gap-2 border-b px-4 py-2"
          style={{ borderColor: "#E5E7EB", background: "#F9FAFB" }}
        >
          <div className="relative flex-1" style={{ minWidth: "160px" }}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#9CA3AF" }} strokeWidth={1.75} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Mot-clé…"
              className="h-8 w-full rounded-lg border pl-8 pr-3 text-[12.5px] outline-none focus:ring-1"
              style={{ borderColor: "#E5E7EB", background: "#fff" }}
            />
          </div>
          <input
            type="text"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="Expéditeur…"
            className="h-8 rounded-lg border px-3 text-[12.5px] outline-none focus:ring-1"
            style={{ borderColor: "#E5E7EB", background: "#fff", width: "160px" }}
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]" style={{ color: "#6B7280" }}>
            <input type="checkbox" checked={hasAttachment} onChange={(e) => setHasAttachment(e.target.checked)} className="h-3.5 w-3.5 rounded" />
            <Paperclip className="h-3 w-3" strokeWidth={1.75} /> Avec PJ
          </label>

          {/* Filtre par correspondant GED */}
          <select
            value={corrId}
            onChange={(e) => setCorrId(e.target.value)}
            title="Filtrer par correspondant"
            className="h-8 rounded-lg border px-2 text-[12.5px] outline-none focus:ring-1"
            style={{ borderColor: corrId ? "#F75C8D" : "#E5E7EB", background: "#fff", color: corrId ? "#F75C8D" : "#374151" }}
          >
            <option value="">Tous les correspondants</option>
            {correspondents.length === 0 ? (
              <option value="" disabled>(aucun correspondant lié)</option>
            ) : (
              correspondents.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))
            )}
          </select>
          {corrId && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium" style={{ background: "#FDECF2", color: "#F75C8D" }}>
              {correspondents.find((c) => String(c.id) === corrId)?.name}
              <button type="button" onClick={() => setCorrId("")}><X className="h-3 w-3" strokeWidth={2.5} /></button>
            </span>
          )}

          {/* Chips filtres actifs */}
          {keyword && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium" style={{ background: "#EBF3FD", color: "#F75C8D" }}>
              {keyword}
              <button type="button" onClick={() => setKeyword("")}><X className="h-3 w-3" strokeWidth={2.5} /></button>
            </span>
          )}
          {sender && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium" style={{ background: "#F0FDF4", color: "#137333" }}>
              From: {sender}
              <button type="button" onClick={() => setSender("")}><X className="h-3 w-3" strokeWidth={2.5} /></button>
            </span>
          )}
        </div>
      )}

      {/* ── Liste emails ── */}
      <div className="flex-1 overflow-y-auto">
        {visibleThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24" style={{ color: "#9CA3AF" }}>
            <Mail className="mb-3 h-10 w-10" strokeWidth={1} />
            <p className="text-[14px] font-medium" style={{ color: "#374151" }}>
              {hasActiveSearch ? "Aucun résultat" : "Boîte vide"}
            </p>
            <p className="mt-1 text-[12.5px]">
              {hasActiveSearch ? "Modifiez les filtres ou réinitialisez." : "Aucun email dans cette vue."}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {visibleThreads.map((thread) => {
                const isSelected = bulk.isSelected(thread.id);
                const isUnread = thread.unread;
                const name = senderName(thread);
                const color = avatarColor(name);
                const ini = initials(name);
                const email = senderEmail(thread);
                const links = linksByThread.get(thread.id) ?? [];
                const hasGedLink = links.length > 0;
                const att = attachmentBadge(thread.attachmentCount, attachmentsByThread.get(thread.id));

                return (
                  <tr
                    key={thread.id}
                    className="group border-b transition"
                    style={{
                      borderColor: "#F3F4F6",
                      background: isSelected
                        ? "#EBF3FD"
                        : isUnread
                        ? "#fff"
                        : "#FAFAFA",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.background = isUnread ? "#fff" : "#FAFAFA";
                    }}
                  >
                    {/* Unread dot */}
                    <td className="w-5 pl-3 pr-1">
                      {isUnread ? (
                        <span className="block h-2 w-2 rounded-full" style={{ background: "#F75C8D" }} />
                      ) : (
                        <span className="block h-2 w-2" />
                      )}
                    </td>

                    {/* Checkbox */}
                    <td className="w-8 px-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => bulk.toggle(thread.id)}
                        className="h-4 w-4 rounded opacity-0 transition group-hover:opacity-100"
                        style={{ opacity: isSelected ? 1 : undefined }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Sélectionner ${name}`}
                      />
                    </td>

                    {/* Star */}
                    <td className="w-7 px-1">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded transition hover:text-yellow-400"
                        style={{ color: thread.important ? "#FBBC04" : "#D1D5DB" }}
                        aria-label="Favori"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Star
                          className="h-4 w-4"
                          strokeWidth={1.75}
                          fill={thread.important ? "#FBBC04" : "none"}
                        />
                      </button>
                    </td>

                    {/* Avatar */}
                    <td className="w-10 px-2">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{ background: color }}
                      >
                        {ini}
                      </span>
                    </td>

                    {/* Sender */}
                    <td className="w-40 px-2">
                      <Link href={`/messagerie/thread/${thread.id}`} className="block">
                        <span
                          className="block truncate text-[13px]"
                          style={{ color: "#111827", fontWeight: isUnread ? 700 : 500 }}
                        >
                          {name}
                        </span>
                        <span className="block truncate text-[11px]" style={{ color: "#9CA3AF" }}>
                          {thread.messageCount > 1 ? `${thread.messageCount} messages` : ""}
                        </span>
                      </Link>
                    </td>

                    {/* Subject */}
                    <td className="w-52 px-2">
                      <Link href={`/messagerie/thread/${thread.id}`} className="block">
                        <span
                          className="block truncate text-[13px]"
                          style={{ color: "#111827", fontWeight: isUnread ? 700 : 500 }}
                        >
                          {thread.subject ?? "(sans sujet)"}
                        </span>
                      </Link>
                    </td>

                    {/* Preview + attachments */}
                    <td className="px-2">
                      <Link href={`/messagerie/thread/${thread.id}`} className="block">
                        {/* Snippet */}
                        <p
                          className="line-clamp-2 text-[12.5px] leading-snug"
                          style={{ color: "#6B7280" }}
                        >
                          {thread.snippet ?? ""}
                        </p>
                        {/* État des pièces jointes (import GED) — #5 */}
                        {att && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold"
                              style={{ background: att.bg, color: att.color }}
                            >
                              <Paperclip className="h-3 w-3" strokeWidth={2} />
                              {thread.attachmentCount > 0 ? `${thread.attachmentCount} PJ · ${att.label}` : att.label}
                            </span>
                          </div>
                        )}
                        {/* Lien GED */}
                        {hasGedLink && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#F75C8D" }}>
                            <FileUp className="h-3 w-3" strokeWidth={1.75} />
                            GED
                          </span>
                        )}
                      </Link>
                    </td>

                    {/* Time + actions */}
                    <td className="w-28 pr-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Actions rapides (visible au hover) */}
                        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            disabled={hidingBusy}
                            onClick={() => void hideSenderFn(email, thread.participants[0]?.name ?? null)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-amber-50"
                            style={{ color: "#D97706" }}
                            title="Masquer cet expéditeur"
                          >
                            <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                          {thread.attachmentCount > 0 && (
                            <Link
                              href={`/messagerie/thread/${thread.id}#attachments`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-blue-50"
                              style={{ color: "#F75C8D" }}
                              title="Ajouter PJ à la GED"
                            >
                              <FileUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </Link>
                          )}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setContextId(contextId === thread.id ? null : thread.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-gray-100"
                              style={{ color: "#9CA3AF" }}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                            {contextId === thread.id && (
                              <div
                                className="absolute right-0 top-8 z-30 w-44 rounded-xl border bg-white py-1 shadow-lg"
                                style={{ borderColor: "#E5E7EB" }}
                              >
                                <Link
                                  href={`/messagerie/thread/${thread.id}`}
                                  className="flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-gray-50"
                                  style={{ color: "#374151" }}
                                  onClick={() => setContextId(null)}
                                >
                                  Ouvrir
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => { void hideSenderFn(email, thread.participants[0]?.name ?? null); }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-amber-50"
                                  style={{ color: "#D97706" }}
                                >
                                  <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                                  Masquer expéditeur
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Heure */}
                        <span
                          className="shrink-0 text-[12px]"
                          style={{ color: isUnread ? "#F75C8D" : "#9CA3AF", fontWeight: isUnread ? 600 : 400 }}
                        >
                          {formatTime(thread.lastMessageAt)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Voir plus */}
        {visibleThreads.length > 0 && (
          <div className="flex flex-col items-center gap-1.5 py-5">
            {nextPageToken ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex h-9 items-center gap-2 rounded-[20px] border-[1.5px] bg-white px-5 text-[13px] font-bold transition hover:bg-[#FCFAF7] disabled:opacity-50"
                style={{ borderColor: "#374151", color: "#374151" }}
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Voir plus
              </button>
            ) : (
              <p className="text-[12px]" style={{ color: "#9CA3AF" }}>Tous les mails sont affichés.</p>
            )}
            <span className="text-[11px]" style={{ color: "#9CA3AF" }}>{visibleThreads.length} mail(s) affiché(s)</span>
          </div>
        )}
      </div>

      {/* Fermer le menu contexte */}
      {contextId && (
        <div className="fixed inset-0 z-20" onClick={() => setContextId(null)} aria-hidden="true" />
      )}

      {showClassify && (
        <MailClassifyPanel
          threadIds={Array.from(bulk.selectedIds).map(String)}
          onClose={() => setShowClassify(false)}
          onSuccess={(n, folder) => {
            setShowClassify(false);
            bulk.clearAll();
            setClassifyToast(`${n} mail${n > 1 ? "s" : ""} classé${n > 1 ? "s" : ""} dans « ${folder} »`);
            window.setTimeout(() => setClassifyToast(null), 4000);
          }}
        />
      )}

      {classifyToast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-2xl px-4 py-3 text-[13px] font-semibold text-white shadow-xl" style={{ background: "var(--accent)" }} role="status">
          {classifyToast}
        </div>
      )}

      <ConfirmActionDialog
        isOpen={confirmBulkHide}
        onClose={() => setConfirmBulkHide(false)}
        onConfirm={() => void bulkHide()}
        variant="warning"
        title={`Masquer ${bulk.selectedCount} expéditeur(s) ?`}
        description="Ces expéditeurs seront cachés dans la surcouche GED. Les emails restent dans Gmail."
        confirmLabel="Masquer"
        loading={hidingBusy}
      />
    </div>
  );
}
