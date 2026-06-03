"use client";

import { useState } from "react";
import { EyeOff, Loader2, Search, Trash2, TriangleAlert } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import type { HiddenSender } from "@/lib/messaging/hidden-senders-store";

type Props = {
  initialSenders: HiddenSender[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function HiddenSendersClient({ initialSenders }: Props) {
  const [senders, setSenders] = useState<HiddenSender[]>(initialSenders);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = senders.filter(
    (s) =>
      !search ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.displayName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const bulk = useBulkSelect(filtered, (s) => s.id);

  async function restore(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/messaging/hidden-senders/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSenders((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function restoreSelected() {
    setBusy(true);
    setError(null);
    const ids = [...bulk.selectedIds] as string[];
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/messaging/hidden-senders/${id}`, {
            method: "DELETE",
            credentials: "include",
          }),
        ),
      );
      setSenders((prev) => prev.filter((s) => !ids.includes(s.id)));
      bulk.clearAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messaging/hidden-senders?confirm=CLEAR_ALL", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSenders([]);
      bulk.clearAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "var(--text-main)" }}>
            Expéditeurs masqués
          </h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {senders.length} expéditeur(s) — leurs emails n&apos;apparaissent plus dans la messagerie GED.
          </p>
        </div>
        {senders.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold transition hover:bg-rose-50 disabled:opacity-50"
            style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Vider la liste
          </button>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-[13px] text-rose-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Recherche */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
          strokeWidth={1.75}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un expéditeur…"
          className="h-10 w-full rounded-xl border pl-9 pr-4 text-[13px] outline-none focus:ring-2"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        />
      </div>

      {/* Barre actions groupées */}
      {bulk.selectedCount > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5"
          style={{ borderColor: "var(--blue-600)", background: "rgba(11,92,255,0.05)" }}
        >
          <span className="text-[13px] font-bold" style={{ color: "var(--blue-600)" }}>
            {bulk.selectedCount} sélectionné(s)
          </span>
          <button
            type="button"
            onClick={() => void restoreSelected()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition hover:bg-emerald-50 disabled:opacity-50"
            style={{ borderColor: "#6EE7B7", color: "#059669" }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />}
            Restaurer la sélection
          </button>
          <button
            type="button"
            onClick={() => bulk.clearAll()}
            className="ml-auto text-[12px]"
            style={{ color: "var(--text-muted)" }}
          >
            Désélectionner
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl border bg-white p-10 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <EyeOff className="mx-auto mb-3 h-8 w-8" style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
          <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
            {search ? "Aucun résultat" : "Aucun expéditeur masqué"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {search
              ? "Modifiez votre recherche."
              : "Masquez des expéditeurs depuis la messagerie via le menu ···."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr
                className="border-b text-left text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}
              >
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={bulk.isAllSelected}
                    onChange={() => bulk.toggleAll()}
                    aria-label="Tout sélectionner"
                    className="h-4 w-4 rounded"
                  />
                </th>
                <th className="px-3 py-3">Expéditeur</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Masqué le</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sender) => (
                <tr
                  key={sender.id}
                  className="border-b last:border-0 transition"
                  style={{
                    borderColor: "var(--border)",
                    background: bulk.isSelected(sender.id)
                      ? "rgba(11,92,255,0.04)"
                      : "var(--bg-main)",
                  }}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={bulk.isSelected(sender.id)}
                      onChange={() => bulk.toggle(sender.id)}
                      aria-label={`Sélectionner ${sender.email}`}
                      className="h-4 w-4 rounded"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium" style={{ color: "var(--text-main)" }}>
                    {sender.displayName ?? "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {sender.email}
                  </td>
                  <td className="px-3 py-3" style={{ color: "var(--text-muted)" }}>
                    {formatDate(sender.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void restore(sender.id)}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition hover:bg-emerald-50 disabled:opacity-50"
                      style={{ borderColor: "#6EE7B7", color: "#059669" }}
                    >
                      Restaurer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmActionDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => void clearAll()}
        variant="delete"
        title="Vider la liste des expéditeurs masqués ?"
        description="Tous les expéditeurs masqués seront restaurés et leurs emails réapparaîtront dans la messagerie GED au prochain rafraîchissement."
        confirmLabel="Vider la liste"
        loading={busy}
      />
    </div>
  );
}
