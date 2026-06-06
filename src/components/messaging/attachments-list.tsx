"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  FileDown,
  Inbox,
  Loader2,
  Mail,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { FileTypeBadge } from "@/components/ui/file-type-badge";
import type { AttachmentOrigin, AttachmentRow } from "@/lib/messaging/load-attachments";
import type { CorrespondentFilter } from "@/lib/messaging/correspondent-filters";

function formatSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

const AVATAR_COLORS = ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#FF6D00", "#46BDC6", "#7B61FF", "#E91E63", "#009688", "#795548"];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return `${p[0][0]}${p[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type RowStatus = AttachmentRow["status"];

function statusBadge(status: RowStatus): { label: string; bg: string; color: string } | null {
  switch (status) {
    case "imported": return { label: "Dans la GED", bg: "#DCFCE7", color: "#15803D" };
    case "pending": return { label: "Import en cours…", bg: "#FEF3C7", color: "#B45309" };
    case "error": return { label: "Erreur d'import", bg: "#FEE2E2", color: "#B91C1C" };
    case "ignored": return { label: "Ignorée", bg: "#F1F5F9", color: "#64748B" };
    default: return { label: "Non importée", bg: "#FEF3C7", color: "#B45309" };
  }
}

// ── Filtres ───────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "none" | "imported" | "pending" | "error" | "linked";
type TypeFilter = "all" | "pdf" | "image" | "word" | "excel" | "archive" | "other";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "none", label: "Non importée" },
  { value: "imported", label: "Importée" },
  { value: "pending", label: "Import en cours" },
  { value: "error", label: "Erreur d'import" },
  { value: "linked", label: "Liée à un document GED" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "pdf", label: "PDF" },
  { value: "image", label: "Image" },
  { value: "word", label: "Word" },
  { value: "excel", label: "Excel" },
  { value: "archive", label: "Archive" },
  { value: "other", label: "Autre" },
];

/** Catégorise une pièce jointe (mime + extension) pour le filtre « Type de fichier ». */
function fileCategory(mimeType: string, filename: string): Exclude<TypeFilter, "all"> {
  const mime = (mimeType || "").toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (mime.includes("pdf") || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "heic", "tiff", "bmp", "svg"].includes(ext)) return "image";
  if (mime.includes("word") || mime.includes("msword") || mime.includes("wordprocessing") || ["doc", "docx", "odt", "rtf"].includes(ext)) return "word";
  if (mime.includes("sheet") || mime.includes("excel") || ["xls", "xlsx", "csv", "ods"].includes(ext)) return "excel";
  if (/(zip|rar|7z|tar|gzip|compressed)/.test(mime) || ["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  return "other";
}

function statusMatches(filter: StatusFilter, row: AttachmentRow): boolean {
  switch (filter) {
    case "all": return true;
    case "none": return row.status === "none";
    case "imported": return row.status === "imported";
    case "pending": return row.status === "pending";
    case "error": return row.status === "error";
    case "linked": return row.documentId != null;
  }
}

type TabData = { rows: AttachmentRow[]; nextPageToken: string | null };

type AttachmentsListProps = {
  inbox: TabData;
  sent: TabData;
  correspondents?: CorrespondentFilter[];
};

/**
 * Liste des pièces jointes au style « liste de mails » (inbox), avec onglets
 * Boîte de réception / Mails envoyés, formulaire de filtrage (mot-clé,
 * correspondant, statut GED, type, période) et « Voir plus » indépendant par
 * onglet. Le filtrage s'applique uniquement à l'onglet actif.
 */
export function AttachmentsList({ inbox, sent, correspondents = [] }: AttachmentsListProps) {
  const [data, setData] = useState<Record<AttachmentOrigin, TabData>>({ inbox, sent });
  const [tab, setTab] = useState<AttachmentOrigin>("inbox");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Filtres ──
  const [keyword, setKeyword] = useState("");
  const [debKeyword, setDebKeyword] = useState("");
  const [corrText, setCorrText] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [fileType, setFileType] = useState<TypeFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debounce de la recherche texte
  useEffect(() => {
    const t = setTimeout(() => setDebKeyword(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const active = data[tab];

  // ── Détection auto de l'état GED ──
  // Pour chaque PJ non encore liée, on vérifie côté serveur si un document GED
  // existe déjà (par nom de fichier) et on enregistre la liaison. Le bouton
  // « Ajouter à la GED » bascule alors en « Ajouté à la GED ».
  const attemptedRef = useRef<Set<string>>(new Set());

  async function detectGed(rows: AttachmentRow[]) {
    const items = rows.map((r) => ({
      mailId: r.mailId,
      threadId: r.threadId,
      attachmentId: r.attachmentId,
      filename: r.filename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
    }));
    try {
      const res = await fetch("/api/messaging/attachments/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { results?: Record<string, { status: RowStatus; documentId: number | null; documentTitle: string | null }> };
      const results = json.results ?? {};
      setData((prev) => {
        const patch = (list: AttachmentRow[]) =>
          list.map((r) => {
            const found = results[r.key];
            return found && found.status !== "none"
              ? { ...r, status: found.status, documentId: found.documentId, documentTitle: found.documentTitle }
              : r;
          });
        return {
          inbox: { ...prev.inbox, rows: patch(prev.inbox.rows) },
          sent: { ...prev.sent, rows: patch(prev.sent.rows) },
        };
      });
    } catch {
      /* détection best-effort : on ignore les erreurs */
    }
  }

  useEffect(() => {
    const pending = active.rows.filter((r) => r.status === "none" && !attemptedRef.current.has(r.key));
    if (pending.length === 0) return;
    pending.forEach((r) => attemptedRef.current.add(r.key));
    void detectGed(pending);
  }, [tab, active.rows]);

  // Correspondant sélectionné via la liste → on étend à toutes ses adresses
  const corrEmails = useMemo(() => {
    const q = corrText.trim().toLowerCase();
    if (!q) return null;
    const match = correspondents.find((c) => c.name.toLowerCase() === q);
    return match ? match.emails.map((e) => e.toLowerCase()) : null;
  }, [corrText, correspondents]);

  // Datalist d'autocomplétion : correspondants GED + personnes présentes
  const corrSuggestions = useMemo(() => {
    const names = new Set<string>();
    for (const c of correspondents) names.add(c.name);
    for (const r of [...data.inbox.rows, ...data.sent.rows]) {
      if (r.personName) names.add(r.personName);
      if (r.personEmail) names.add(r.personEmail);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b)).slice(0, 200);
  }, [correspondents, data]);

  const filteredRows = useMemo(() => {
    const kw = debKeyword.trim().toLowerCase();
    const corrQ = corrText.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return active.rows.filter((r) => {
      if (kw) {
        const hay = [r.filename, r.subject, r.personName, r.personEmail, r.documentTitle]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(kw));
        if (!hay) return false;
      }
      if (corrQ) {
        const ok = corrEmails
          ? corrEmails.includes(r.personEmail.toLowerCase())
          : r.personName.toLowerCase().includes(corrQ) || r.personEmail.toLowerCase().includes(corrQ);
        if (!ok) return false;
      }
      if (!statusMatches(status, r)) return false;
      if (fileType !== "all" && fileCategory(r.mimeType, r.filename) !== fileType) return false;
      if (fromTs != null || toTs != null) {
        if (!r.date) return false;
        const t = new Date(r.date).getTime();
        if (fromTs != null && t < fromTs) return false;
        if (toTs != null && t > toTs) return false;
      }
      return true;
    });
  }, [active.rows, debKeyword, corrText, corrEmails, status, fileType, dateFrom, dateTo]);

  const hasActiveFilters = Boolean(
    debKeyword.trim() || corrText.trim() || status !== "all" || fileType !== "all" || dateFrom || dateTo,
  );

  function resetFilters() {
    setKeyword("");
    setDebKeyword("");
    setCorrText("");
    setStatus("all");
    setFileType("all");
    setDateFrom("");
    setDateTo("");
  }

  // ── Import GED ──
  function setRow(key: string, patch: Partial<AttachmentRow>) {
    setData((prev) => ({
      inbox: { ...prev.inbox, rows: prev.inbox.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) },
      sent: { ...prev.sent, rows: prev.sent.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) },
    }));
  }
  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function importOne(row: AttachmentRow) {
    if (busy.has(row.key) || row.status === "imported" || row.status === "pending") return;
    setBusy((prev) => new Set(prev).add(row.key));
    setRow(row.key, { status: "pending" });
    try {
      const res = await fetch("/api/messaging/attachments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mailId: row.mailId,
          threadId: row.threadId,
          attachmentId: row.attachmentId,
          filename: row.filename,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
        }),
      });
      const dataRes = (await res.json().catch(() => ({}))) as { link?: { status?: RowStatus; paperlessDocumentId?: number | null; documentTitle?: string | null } };
      if (!res.ok) {
        setRow(row.key, { status: "error" });
      } else {
        setRow(row.key, {
          status: dataRes.link?.status ?? "imported",
          documentId: dataRes.link?.paperlessDocumentId ?? row.documentId,
          documentTitle: dataRes.link?.documentTitle ?? row.documentTitle,
        });
      }
    } catch {
      setRow(row.key, { status: "error" });
    } finally {
      setBusy((prev) => { const n = new Set(prev); n.delete(row.key); return n; });
    }
  }

  async function importSelected() {
    const targets = filteredRows.filter((r) => selected.has(r.key) && r.status !== "imported" && r.status !== "pending");
    setSelected(new Set());
    for (const r of targets) await importOne(r);
  }

  // ── Voir plus (par onglet) ──
  async function loadMore() {
    if (!active.nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ origin: tab, limit: "25", pageToken: active.nextPageToken });
      const res = await fetch(`/api/messaging/attachments?${params.toString()}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { rows?: AttachmentRow[]; nextPageToken?: string | null };
      setData((prev) => {
        const seen = new Set(prev[tab].rows.map((r) => r.key));
        const merged = [...prev[tab].rows, ...(json.rows ?? []).filter((r) => !seen.has(r.key))];
        return { ...prev, [tab]: { rows: merged, nextPageToken: json.nextPageToken ?? null } };
      });
    } catch {
      /* on garde la liste courante */
    } finally {
      setLoadingMore(false);
    }
  }

  const importable = filteredRows.filter((r) => r.status !== "imported" && r.status !== "pending");
  const allImportableSelected = importable.length > 0 && importable.every((r) => selected.has(r.key));

  const TABS: { id: AttachmentOrigin; label: string; icon: typeof Inbox }[] = [
    { id: "inbox", label: "Boîte de réception", icon: Inbox },
    { id: "sent", label: "Mails envoyés", icon: Send },
  ];

  function tabCount(origin: AttachmentOrigin): string {
    const n = data[origin].rows.length;
    return data[origin].nextPageToken ? `${n}+` : String(n);
  }

  return (
    <div className="space-y-3">
      {/* ── Onglets origine ── */}
      <div className="flex items-center gap-1.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); setSelected(new Set()); }}
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition"
              style={{
                background: isActive ? "#FDECF2" : "transparent",
                color: isActive ? "#F75C8D" : "var(--text-muted)",
              }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {label}
              <span
                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
                style={{
                  background: isActive ? "#F75C8D" : "var(--surface)",
                  color: isActive ? "#fff" : "var(--text-hint)",
                }}
              >
                {tabCount(id)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Formulaire de filtrage ── */}
      <div className="rounded-2xl border bg-white p-2.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Recherche */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Rechercher une pièce jointe, un mail, un mot-clé…"
              className="h-9 w-full rounded-lg border pl-8 pr-3 text-[12.5px] outline-none focus:ring-1"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            />
          </div>

          {/* Correspondant (autocomplétion) */}
          <input
            type="text"
            value={corrText}
            onChange={(e) => setCorrText(e.target.value)}
            list="att-corr-list"
            placeholder="Correspondant…"
            className="h-9 w-[180px] rounded-lg border px-3 text-[12.5px] outline-none focus:ring-1"
            style={{ borderColor: corrText ? "#F75C8D" : "var(--border)", background: "var(--surface)", color: corrText ? "#F75C8D" : undefined }}
          />
          <datalist id="att-corr-list">
            {corrSuggestions.map((s) => <option key={s} value={s} />)}
          </datalist>

          {/* Statut GED */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            title="Statut GED"
            className="h-9 rounded-lg border px-2 text-[12.5px] outline-none focus:ring-1"
            style={{ borderColor: status !== "all" ? "#F75C8D" : "var(--border)", background: "var(--surface)", color: status !== "all" ? "#F75C8D" : undefined }}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === "all" ? "Statut : tous" : o.label}</option>)}
          </select>

          {/* Plus de filtres */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition hover:bg-[#FCFAF7]"
            style={{ borderColor: "var(--border)", color: showAdvanced ? "#F75C8D" : "var(--text-main)" }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Plus de filtres
          </button>

          {/* Réinitialiser */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium transition hover:bg-gray-50"
              style={{ color: "var(--text-muted)" }}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Réinitialiser
            </button>
          )}
        </div>

        {/* Filtres avancés */}
        {showAdvanced && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5" style={{ borderColor: "var(--border)" }}>
            <label className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Type
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value as TypeFilter)}
                className="h-9 rounded-lg border px-2 text-[12.5px] outline-none focus:ring-1"
                style={{ borderColor: fileType !== "all" ? "#F75C8D" : "var(--border)", background: "var(--surface)", color: fileType !== "all" ? "#F75C8D" : undefined }}
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Du
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 rounded-lg border px-2 text-[12.5px] outline-none focus:ring-1"
                style={{ borderColor: dateFrom ? "#F75C8D" : "var(--border)", background: "var(--surface)" }}
              />
            </label>
            <label className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Au
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 rounded-lg border px-2 text-[12.5px] outline-none focus:ring-1"
                style={{ borderColor: dateTo ? "#F75C8D" : "var(--border)", background: "var(--surface)" }}
              />
            </label>
          </div>
        )}

        {/* Badges de filtres actifs */}
        {hasActiveFilters && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {debKeyword.trim() && (
              <FilterChip label={`Mot-clé : ${debKeyword.trim()}`} onClear={() => { setKeyword(""); setDebKeyword(""); }} />
            )}
            {corrText.trim() && (
              <FilterChip label={`Correspondant : ${corrText.trim()}`} onClear={() => setCorrText("")} />
            )}
            {status !== "all" && (
              <FilterChip label={`Statut : ${STATUS_OPTIONS.find((o) => o.value === status)?.label}`} onClear={() => setStatus("all")} />
            )}
            {fileType !== "all" && (
              <FilterChip label={`Type : ${TYPE_OPTIONS.find((o) => o.value === fileType)?.label}`} onClear={() => setFileType("all")} />
            )}
            {dateFrom && <FilterChip label={`Du ${dateFrom}`} onClear={() => setDateFrom("")} />}
            {dateTo && <FilterChip label={`Au ${dateTo}`} onClear={() => setDateTo("")} />}
          </div>
        )}
      </div>

      {/* ── Liste ── */}
      <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
        {/* Barre d'en-tête : sélection + action groupée */}
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <label className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={allImportableSelected}
              onChange={() => setSelected(allImportableSelected ? new Set() : new Set(importable.map((r) => r.key)))}
              disabled={importable.length === 0}
              className="h-4 w-4 accent-[var(--accent)] disabled:opacity-40"
              aria-label="Tout sélectionner"
            />
            {filteredRows.length} pièce(s) jointe(s){hasActiveFilters ? " · filtrées" : ""}
          </label>
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={() => void importSelected()}
              className="inline-flex h-8 items-center gap-1.5 rounded-[20px] px-3 text-[12px] font-bold text-white transition hover:opacity-90"
              style={{ background: "var(--accent)" }}
            >
              <FileDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Ajouter à la GED ({selected.size})
            </button>
          ) : null}
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>
              {active.rows.length === 0
                ? tab === "sent" ? "Aucune pièce jointe envoyée" : "Aucune pièce jointe reçue"
                : "Aucun résultat"}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {active.rows.length === 0
                ? tab === "sent" ? "Aucun mail envoyé récent avec pièce jointe." : "Aucun mail reçu récent avec pièce jointe."
                : "Modifiez ou réinitialisez les filtres."}
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filteredRows.map((row) => {
              const badge = statusBadge(row.status);
              const isBusy = busy.has(row.key);
              const canImport = row.status !== "imported" && row.status !== "pending";
              return (
                <li key={row.key} className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-[#FCFAF7]">
                  <input
                    type="checkbox"
                    checked={selected.has(row.key)}
                    onChange={() => toggle(row.key)}
                    disabled={!canImport}
                    className="h-4 w-4 shrink-0 accent-[var(--accent)] disabled:opacity-40"
                    aria-label={`Sélectionner ${row.filename}`}
                  />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: avatarColor(row.personName) }} aria-hidden="true">
                    {initials(row.personName)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[13px] font-bold" style={{ color: "#111827" }} title={row.personName}>
                        {row.personName}
                      </span>
                      {row.subject ? (
                        <span className="hidden truncate text-[11.5px] sm:inline" style={{ color: "#9CA3AF" }}>· {row.subject}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px]" style={{ color: "#6B7280" }} title={row.filename}>
                      <FileTypeBadge fileName={row.filename} mimeType={row.mimeType} />
                      <span className="truncate">{row.filename}</span>
                      <span className="shrink-0" style={{ color: "var(--text-hint)" }}>· {formatSize(row.sizeBytes)}</span>
                    </p>
                  </div>

                  {badge ? (
                    <span className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold sm:inline" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  ) : null}
                  <span className="hidden w-16 shrink-0 text-right text-[11px] sm:inline" style={{ color: "var(--text-hint)" }}>{formatDate(row.date)}</span>

                  <div className="flex shrink-0 items-center gap-1">
                    {canImport ? (
                      <button
                        type="button"
                        onClick={() => void importOne(row)}
                        disabled={isBusy}
                        title="Ajouter à la GED"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11.5px] font-bold transition hover:bg-white disabled:opacity-50"
                        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
                        <span className="hidden md:inline">Ajouter à la GED</span>
                      </button>
                    ) : row.status === "imported" && row.documentId ? (
                      <Link
                        href={`/documents/${row.documentId}`}
                        title="Ouvrir le document GED"
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-bold text-white transition hover:opacity-90"
                        style={{ background: "#15803D" }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        <span className="hidden md:inline">Ajouté à la GED</span>
                      </Link>
                    ) : row.status === "imported" ? (
                      <span
                        title="Ajouté à la GED"
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-bold text-white"
                        style={{ background: "#15803D" }}
                      >
                        <FileDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        <span className="hidden md:inline">Ajouté à la GED</span>
                      </span>
                    ) : null}
                    <Link
                      href={`/messagerie/thread/${row.threadId}`}
                      title="Voir le mail source"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-[#FCFAF7]"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                    >
                      <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Voir plus (par onglet) */}
        {active.rows.length > 0 && (
          <div className="flex flex-col items-center gap-1.5 border-t py-4" style={{ borderColor: "var(--border)" }}>
            {active.nextPageToken ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex h-9 items-center gap-2 rounded-[20px] border-[1.5px] bg-white px-5 text-[13px] font-bold transition hover:bg-[#FCFAF7] disabled:opacity-50"
                style={{ borderColor: "#374151", color: "#374151" }}
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Voir plus
              </button>
            ) : (
              <p className="text-[12px]" style={{ color: "var(--text-hint)" }}>Toutes les pièces jointes sont affichées.</p>
            )}
            <span className="text-[11px]" style={{ color: "var(--text-hint)" }}>
              {filteredRows.length} affichée(s){hasActiveFilters ? ` sur ${active.rows.length} chargée(s)` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string | undefined; onClear: () => void }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium" style={{ background: "#FDECF2", color: "#F75C8D" }}>
      {label}
      <button type="button" onClick={onClear} aria-label={`Retirer ${label}`}>
        <X className="h-3 w-3" strokeWidth={2.5} />
      </button>
    </span>
  );
}
