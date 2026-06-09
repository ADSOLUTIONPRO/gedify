"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setAssistantOverrides, clearAssistantOverrides } from "@/components/ai-assistant/assistant-context-provider";
import { Check, Eye, FileText, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { ResponsiveDetailPanel } from "@/components/layout/responsive-detail-panel";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { BulkActionsToolbar } from "@/components/common/bulk-actions-toolbar";
import { FileTypeBadge } from "@/components/ui/file-type-badge";
import { FinanceDocPreviewModal } from "@/components/finances/finance-doc-preview-modal";
import { formatAmount } from "@/components/finances/finance-labels";
import {
  PRINCIPAL_LABELS, PRINCIPAL_ORDER, applyPrincipalType, getDisplayStatus, getPrincipalType,
  statusChoices, temporalBucket, TEMPORAL_LABELS,
  type PrincipalType, type TemporalBucket,
} from "@/lib/budget/finance-classification";
import { formatDate, toDateInputValue } from "@/lib/format";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import type { FinancialItem, FinancialItemStatus } from "@/lib/budget/financial-item-types";

type FinancialItemsTableProps = {
  items: FinancialItem[];
  emptyLabel?: string;
  /** Affiche le formulaire de paiement dans le détail (dépenses / dettes). */
  allowPayment?: boolean;
};

const ACCOUNTS = ["Compte courant", "Épargne", "Carte", "Espèces", "Autre"] as const;

const TONE_STYLE: Record<string, { bg: string; color: string }> = {
  emerald: { bg: "#EAF8EF", color: "#15803D" },
  amber: { bg: "#FFF4E5", color: "#B45309" },
  rose: { bg: "#FEECEC", color: "#DC2626" },
  slate: { bg: "#F1F5F9", color: "#64748B" },
  orange: { bg: "#FFF1E6", color: "#C2410C" },
  blue: { bg: "#E7F0FF", color: "#2563EB" },
  violet: { bg: "#F3EEFF", color: "#7C3AED" },
};

function remainingOf(i: FinancialItem): number {
  return i.amountRemaining ?? Math.max(0, i.amount - i.amountPaid);
}

export function FinancialItemsTable({ items, emptyLabel = "Aucun élément.", allowPayment = false }: FinancialItemsTableProps) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  // Expose la ligne budget active à l'assistant IA contextuel.
  useEffect(() => {
    setAssistantOverrides({ activeBudgetEntryId: activeId });
    return () => clearAssistantOverrides();
  }, [activeId]);

  const [flash, setFlash] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payAccount, setPayAccount] = useState<string>(ACCOUNTS[0]);
  const [previewDocId, setPreviewDocId] = useState<number | null>(null);

  // Filtres (§17)
  const [fSearch, setFSearch] = useState("");
  const [fType, setFType] = useState<"" | PrincipalType>("");
  const [fTemporal, setFTemporal] = useState<"" | TemporalBucket>("");
  const [fDoc, setFDoc] = useState<"" | "with" | "without">("");

  const bulk = useBulkSelect(items, (item) => item.id);

  const filtered = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !(i.label.toLowerCase().includes(q) || (i.correspondentName ?? "").toLowerCase().includes(q))) return false;
      if (fType && getPrincipalType(i) !== fType) return false;
      if (fTemporal && temporalBucket(i) !== fTemporal) return false;
      if (fDoc === "with" && i.sourceDocumentId == null) return false;
      if (fDoc === "without" && i.sourceDocumentId != null) return false;
      return true;
    });
  }, [items, fSearch, fType, fTemporal, fDoc]);

  const active = items.find((i) => i.id === activeId) ?? null;

  function showFlash(text: string) {
    setFlash(text);
    window.setTimeout(() => setFlash(null), 1800);
  }

  async function patch(id: string, body: Record<string, unknown>, flashText = "Enregistré") {
    setBusy(true);
    try {
      const res = await fetch(`/api/budget/financial-items/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.ok) showFlash(flashText);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/budget/financial-items/${id}`, { method: "DELETE", credentials: "include" });
      setActiveId(null);
      setConfirmDelete(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    setBulkDeleting(true);
    setBulkError(null);
    try {
      const ids = [...bulk.selectedIds] as string[];
      const res = await fetch("/api/budget/financial-items/bulk-delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", cache: "no-store",
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || "error" in data) throw new Error(data.error ?? `HTTP ${res.status}`);
      bulk.clearAll();
      if (activeId && ids.includes(activeId)) setActiveId(null);
      router.refresh();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Erreur lors de la suppression");
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  }

  async function addPayment(id: string) {
    const amount = Number(payAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    setBusy(true);
    try {
      await fetch(`/api/budget/financial-items/${id}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ amount, date: payDate || undefined }),
      });
      setPayAmount("");
      showFlash("Paiement ajouté");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function setStatusValue(item: FinancialItem, value: FinancialItemStatus) {
    if (value === "validated") return patch(item.id, { status: "validated", validationStatus: "validated" });
    if (value === "ignored") return patch(item.id, { status: "ignored", validationStatus: "ignored" });
    return patch(item.id, { status: value });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <BulkActionsToolbar
        bulk={bulk}
        entityLabel="ligne"
        actions={[{ label: bulkDeleting ? "Suppression…" : "Supprimer la sélection", icon: Trash2, tone: "danger", loading: bulkDeleting, onClick: () => setConfirmBulkDelete(true) }]}
      />
      {bulkError && <p className="text-[12.5px] font-semibold text-rose-700">{bulkError}</p>}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2.5" style={{ borderColor: "var(--border)" }}>
        <input value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Rechercher (libellé, correspondant)…" className="h-9 min-w-[180px] flex-1 rounded-lg border px-2.5 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
        <select value={fType} onChange={(e) => setFType(e.target.value as PrincipalType | "")} className={filterSelect}>
          <option value="">Type…</option>
          {PRINCIPAL_ORDER.map((t) => <option key={t} value={t}>{PRINCIPAL_LABELS[t]}</option>)}
        </select>
        <select value={fTemporal} onChange={(e) => setFTemporal(e.target.value as TemporalBucket | "")} className={filterSelect}>
          <option value="">Période…</option>
          {(["overdue", "this_week", "this_month", "later", "undated"] as TemporalBucket[]).map((b) => <option key={b} value={b}>{TEMPORAL_LABELS[b]}</option>)}
        </select>
        <select value={fDoc} onChange={(e) => setFDoc(e.target.value as "" | "with" | "without")} className={filterSelect}>
          <option value="">Document…</option>
          <option value="with">Avec document</option>
          <option value="without">Sans document</option>
        </select>
        {flash ? <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: "#15803D" }}><Check className="h-3.5 w-3.5" strokeWidth={2.5} /> {flash}</span> : null}
      </div>

      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          <div className="overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
            <table className="w-full min-w-[1000px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  <th className="w-8 px-2 py-2"><input type="checkbox" checked={bulk.isAllSelected} onChange={() => bulk.toggleAll()} aria-label="Tout sélectionner" className="h-4 w-4 rounded" /></th>
                  {["Date", "Échéance", "Libellé", "Correspondant", "Type", "Catégorie", "Montant", "Payé", "Reste", "Statut", "Doc", ""].map((h, i) => (
                    <th key={i} className={`px-2 py-2 text-[10.5px] font-bold uppercase tracking-wide ${["Montant", "Payé", "Reste"].includes(h) ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const remaining = remainingOf(item);
                  const ds = getDisplayStatus(item);
                  const pt = getPrincipalType(item);
                  const isActive = item.id === active?.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setActiveId(item.id)}
                      className="cursor-pointer border-b transition last:border-b-0 hover:bg-slate-50"
                      style={{ borderColor: "var(--border)", background: isActive ? "rgba(22,163,74,0.05)" : undefined, boxShadow: isActive ? "inset 2px 0 0 #16A34A" : undefined }}
                    >
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={bulk.isSelected(item.id)} onChange={() => bulk.toggle(item.id)} aria-label={`Sélectionner ${item.label}`} className="h-4 w-4 rounded" />
                      </td>
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}><EditableDate value={item.documentDate} onCommit={(v) => patch(item.id, { documentDate: v || null })} /></td>
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}><EditableDate value={item.dueDate} onCommit={(v) => patch(item.id, { dueDate: v || null })} /></td>
                      <td className="max-w-[220px] px-2 py-1.5" onClick={(e) => e.stopPropagation()}><EditableText value={item.label} onCommit={(v) => v.trim() && patch(item.id, { label: v.trim() })} bold /></td>
                      <td className="max-w-[150px] px-2 py-1.5" onClick={(e) => e.stopPropagation()}><EditableText value={item.correspondentName ?? ""} placeholder="—" onCommit={(v) => patch(item.id, { correspondentName: v.trim() || null })} /></td>
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <select value={pt} onChange={(e) => patch(item.id, applyPrincipalType(e.target.value as PrincipalType) as Record<string, unknown>)} className={cellSelect}>
                          {PRINCIPAL_ORDER.map((t) => <option key={t} value={t}>{PRINCIPAL_LABELS[t]}</option>)}
                        </select>
                      </td>
                      <td className="max-w-[130px] px-2 py-1.5" onClick={(e) => e.stopPropagation()}><EditableText value={item.categoryName ?? ""} placeholder="—" onCommit={(v) => patch(item.id, { categoryName: v.trim() || null })} /></td>
                      <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <EditableNumber value={item.amount} onCommit={(v) => patch(item.id, { amount: v })} suffix={item.currency} align="right" boldColor={item.direction === "incoming" ? "#15803D" : "var(--text-main)"} />
                      </td>
                      <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <EditableNumber value={item.amountPaid} onCommit={(v) => patch(item.id, { amountPaid: v })} suffix={item.currency} align="right" />
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold" style={{ color: remaining > 0 ? "var(--orange)" : "var(--text-muted)" }}>{remaining > 0 ? formatAmount(remaining, item.currency) : "—"}</td>
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <select value={item.status} onChange={(e) => setStatusValue(item, e.target.value as FinancialItemStatus)} className={cellSelect} style={{ background: TONE_STYLE[ds.tone].bg, color: TONE_STYLE[ds.tone].color, fontWeight: 700 }}>
                          {statusChoices(item.direction).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        {item.sourceDocumentId ? (
                          <button type="button" onClick={() => setPreviewDocId(item.sourceDocumentId)} title="Aperçu du document lié" className="transition hover:opacity-80">
                            <FileTypeBadge fileName={item.sourceDocumentTitle} mimeType={null} />
                          </button>
                        ) : <span className="text-[11px]" style={{ color: "var(--text-hint)" }}>—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setActiveId(item.id); }} aria-label="Détail" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                          <Eye className="h-4 w-4" strokeWidth={1.85} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? <p className="mt-3 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune ligne ne correspond aux filtres.</p> : null}
        </div>

        {active ? (
          <ResponsiveDetailPanel title="Détail">
            <DetailPanel
              item={active}
              busy={busy}
              allowPayment={allowPayment}
              payAmount={payAmount} setPayAmount={setPayAmount} payDate={payDate} setPayDate={setPayDate}
              payAccount={payAccount} setPayAccount={setPayAccount}
              accounts={ACCOUNTS}
              onPatch={patch}
              onStatus={setStatusValue}
              onAddPayment={() => addPayment(active.id)}
              onPreview={() => active.sourceDocumentId && setPreviewDocId(active.sourceDocumentId)}
              onDelete={() => setConfirmDelete(true)}
            />
          </ResponsiveDetailPanel>
        ) : null}
      </div>

      <ConfirmDeleteDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => active && deleteItem(active.id)}
        loading={busy}
        title={active ? `Supprimer « ${active.label} » ?` : "Supprimer ?"}
        description="Cet élément financier et ses paiements associés seront définitivement supprimés."
      />
      <ConfirmActionDialog
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => void bulkDelete()}
        variant="delete"
        title={`Supprimer ${bulk.selectedCount} ligne(s) ?`}
        description="Les lignes non validées sélectionnées seront définitivement supprimées."
        confirmLabel="Supprimer la sélection"
        loading={bulkDeleting}
      />

      {previewDocId != null ? <FinanceDocPreviewModal documentId={previewDocId} onClose={() => setPreviewDocId(null)} /> : null}
    </div>
  );
}

const filterSelect = "h-9 rounded-lg border px-2 text-[12.5px] outline-none";
const cellSelect = "h-7 max-w-[140px] rounded-md border px-1.5 text-[12px] outline-none focus:border-[var(--accent)]";

/* ── Cellules éditables ──────────────────────────────────────────────────── */

function EditableText({ value, onCommit, placeholder, bold }: { value: string; onCommit: (v: string) => void; placeholder?: string; bold?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    return (
      <input
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== value) onCommit(draft); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (draft !== value) onCommit(draft); } if (e.key === "Escape") { setEditing(false); setDraft(value); } }}
        className="h-7 w-full rounded-md border px-1.5 text-[12.5px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }}
      />
    );
  }
  return (
    <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className="block w-full truncate text-left hover:underline" style={{ color: value ? "var(--text-main)" : "var(--text-hint)", fontWeight: bold ? 700 : 500 }}>
      {value || placeholder || "—"}
    </button>
  );
}

function EditableNumber({ value, onCommit, suffix, align, boldColor }: { value: number; onCommit: (v: number) => void; suffix?: string; align?: "right"; boldColor?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  function commit() {
    setEditing(false);
    const n = Number(draft.replace(",", "."));
    if (Number.isFinite(n) && n !== value) onCommit(n);
  }
  if (editing) {
    return (
      <input
        autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setDraft(String(value)); } }}
        className={`h-7 w-24 rounded-md border px-1.5 text-[12.5px] outline-none focus:border-[var(--accent)] ${align === "right" ? "text-right" : ""}`} style={{ borderColor: "var(--border)" }}
      />
    );
  }
  return (
    <button type="button" onClick={() => { setDraft(String(value)); setEditing(true); }} className={`block w-full hover:underline ${align === "right" ? "text-right" : "text-left"}`} style={{ color: boldColor ?? "var(--text-main)", fontWeight: boldColor ? 700 : 600 }}>
      {formatAmount(value, suffix ?? "EUR")}
    </button>
  );
}

function EditableDate({ value, onCommit }: { value: string | null; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toDateInputValue(value));
  if (editing) {
    return (
      <input
        autoFocus type="date" value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== toDateInputValue(value)) onCommit(draft); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (draft !== toDateInputValue(value)) onCommit(draft); } if (e.key === "Escape") setEditing(false); }}
        className="h-7 rounded-md border px-1 text-[12px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }}
      />
    );
  }
  return (
    <button type="button" onClick={() => { setDraft(toDateInputValue(value)); setEditing(true); }} className="whitespace-nowrap hover:underline" style={{ color: value ? "var(--text-main)" : "var(--text-hint)" }}>
      {value ? formatDate(value) : "—"}
    </button>
  );
}

/* ── Panneau détail ──────────────────────────────────────────────────────── */

function DetailPanel({
  item, busy, allowPayment, payAmount, setPayAmount, payDate, setPayDate, payAccount, setPayAccount, accounts,
  onPatch, onStatus, onAddPayment, onPreview, onDelete,
}: {
  item: FinancialItem; busy: boolean; allowPayment: boolean;
  payAmount: string; setPayAmount: (v: string) => void; payDate: string; setPayDate: (v: string) => void;
  payAccount: string; setPayAccount: (v: string) => void; accounts: readonly string[];
  onPatch: (id: string, body: Record<string, unknown>, flash?: string) => void;
  onStatus: (item: FinancialItem, v: FinancialItemStatus) => void;
  onAddPayment: () => void; onPreview: () => void; onDelete: () => void;
}) {
  const remaining = remainingOf(item);
  const ds = getDisplayStatus(item);
  const pt = getPrincipalType(item);
  const isReview = item.validationStatus === "needs_review" || item.status === "to_review" || item.status === "suggested";

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-[15px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>{item.label}</h2>
        <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: TONE_STYLE[ds.tone].bg, color: TONE_STYLE[ds.tone].color }}>{ds.label}</span>
      </div>

      {/* Classement éditable */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={detLabel}>Type principal</span>
          <select value={pt} onChange={(e) => onPatch(item.id, applyPrincipalType(e.target.value as PrincipalType) as Record<string, unknown>)} className={detInput}>
            {PRINCIPAL_ORDER.map((t) => <option key={t} value={t}>{PRINCIPAL_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={detLabel}>Statut</span>
          <select value={item.status} onChange={(e) => onStatus(item, e.target.value as FinancialItemStatus)} className={detInput}>
            {statusChoices(item.direction).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={detLabel}>Catégorie</span>
          <input defaultValue={item.categoryName ?? ""} onBlur={(e) => e.target.value !== (item.categoryName ?? "") && onPatch(item.id, { categoryName: e.target.value.trim() || null })} className={detInput} placeholder="—" />
        </label>
        <label className="block">
          <span className={detLabel}>Correspondant</span>
          <input defaultValue={item.correspondentName ?? ""} onBlur={(e) => e.target.value !== (item.correspondentName ?? "") && onPatch(item.id, { correspondentName: e.target.value.trim() || null })} className={detInput} placeholder="—" />
        </label>
        <label className="block">
          <span className={detLabel}>Date document</span>
          <input type="date" defaultValue={toDateInputValue(item.documentDate)} onBlur={(e) => onPatch(item.id, { documentDate: e.target.value || null })} className={detInput} />
        </label>
        <label className="block">
          <span className={detLabel}>Échéance</span>
          <input type="date" defaultValue={toDateInputValue(item.dueDate)} onBlur={(e) => onPatch(item.id, { dueDate: e.target.value || null })} className={detInput} />
        </label>
      </div>

      {/* Répartition des montants (§15) — sous-montants de la MÊME ligne */}
      <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
        <p className={detLabel}>Répartition des montants</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <Amount label="Montant total" value={item.amount} onCommit={(v) => onPatch(item.id, { amount: v })} />
          <Amount label="Montant HT" value={item.amountWithoutTax ?? 0} onCommit={(v) => onPatch(item.id, { amountWithoutTax: v })} />
          <Amount label="TVA" value={item.taxAmount ?? 0} onCommit={(v) => onPatch(item.id, { taxAmount: v })} />
          <Amount label="Déjà payé" value={item.amountPaid} onCommit={(v) => onPatch(item.id, { amountPaid: v })} />
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
          <span className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>Reste dû</span>
          <span className="text-[14px] font-extrabold" style={{ color: remaining > 0 ? "var(--orange)" : "#15803D" }}>{formatAmount(remaining, item.currency)}</span>
        </div>
      </div>

      {/* Note */}
      <label className="block">
        <span className={detLabel}>Note</span>
        <textarea defaultValue={item.notes} onBlur={(e) => e.target.value !== item.notes && onPatch(item.id, { notes: e.target.value })} rows={2} className="w-full resize-none rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} placeholder="Note libre…" />
      </label>

      {/* Paiement */}
      {allowPayment ? (
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
          <p className={detLabel}>Ajouter un paiement</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" placeholder="Montant" className="h-9 w-24 rounded-lg border px-2 text-[13px] outline-none" style={{ borderColor: "var(--border)" }} />
            <input value={payDate} onChange={(e) => setPayDate(e.target.value)} type="date" className="h-9 rounded-lg border px-2 text-[13px] outline-none" style={{ borderColor: "var(--border)" }} />
            <select value={payAccount} onChange={(e) => setPayAccount(e.target.value)} className="h-9 rounded-lg border px-2 text-[13px] outline-none" style={{ borderColor: "var(--border)" }}>
              {accounts.map((a) => <option key={a}>{a}</option>)}
            </select>
            <button type="button" disabled={busy} onClick={onAddPayment} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: "#16A34A" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer
            </button>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-1.5">
        {isReview ? (
          <button type="button" disabled={busy} onClick={() => onPatch(item.id, { validationStatus: "validated", status: item.status === "to_review" || item.status === "suggested" ? "unpaid" : item.status }, "Ligne validée")} className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "#16A34A" }}>
            <Check className="h-4 w-4" strokeWidth={2.5} /> Valider la ligne
          </button>
        ) : null}
        {remaining > 0 ? (
          <button type="button" disabled={busy} onClick={() => onPatch(item.id, { status: "paid", paymentStatus: "paid", amountPaid: item.amount, amountRemaining: 0 }, "Marqué payé")} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "#15803D" }}>
            <Check className="h-4 w-4" strokeWidth={2} /> Marquer payé
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => onStatus(item, "ignored")} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <X className="h-4 w-4" strokeWidth={2} /> Ignorer
        </button>
        {item.sourceDocumentId ? (
          <button type="button" onClick={onPreview} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "#0B5CFF" }}>
            <Eye className="h-4 w-4" strokeWidth={1.85} /> Voir document
          </button>
        ) : null}
        {item.sourceDocumentId ? (
          <button type="button" disabled={busy} onClick={() => { void fetch(`/api/documents/${item.sourceDocumentId}/reanalyze`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true, allowWithoutOcr: true }) }); }} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "#7C3AED" }}>
            <Sparkles className="h-4 w-4" strokeWidth={1.85} /> Relancer IA
          </button>
        ) : null}
      </div>

      <button type="button" onClick={onDelete} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-semibold transition hover:bg-rose-50" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
        <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Supprimer
      </button>

      {!item.sourceDocumentId ? (
        <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <FileText className="h-3.5 w-3.5" strokeWidth={1.75} /> Aucun document lié — lettrage à faire.
        </p>
      ) : null}
    </div>
  );
}

const detLabel = "block text-[10px] font-bold uppercase tracking-[0.1em]";
const detInput = "mt-1 h-9 w-full rounded-lg border px-2 text-[12.5px] outline-none focus:border-[var(--accent)]";

function Amount({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>{label}</span>
      <input defaultValue={String(value)} inputMode="decimal" onBlur={(e) => { const n = Number(e.target.value.replace(",", ".")); if (Number.isFinite(n) && n !== value) onCommit(n); }} className="mt-0.5 h-8 w-full rounded-lg border px-2 text-[12.5px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
    </label>
  );
}
