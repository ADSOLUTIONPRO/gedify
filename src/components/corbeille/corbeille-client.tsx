"use client";

import { useEffect, useReducer, useState } from "react";
import {
  ArchiveRestore,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type TrashItem = {
  id: number;
  title: string;
  deleted_at: string | null;
  document_type: string | number | null;
};

type TrashListResponse = {
  count: number;
  results: TrashItem[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// State for async actions
type AsyncStatus = "idle" | "loading" | "success" | "error";

export function CorbeillecClient() {
  // loadTick increments trigger a reload without calling setState in useEffect
  const [loadTick, reload] = useReducer((n: number) => n + 1, 0);
  const [items, setItems] = useState<TrashItem[]>([]);
  // Start in loading state — effect will update it
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [restoreState, setRestoreState] = useState<AsyncStatus>("idle");
  const [deleteState, setDeleteState] = useState<AsyncStatus>("idle");
  const [emptyState, setEmptyState] = useState<AsyncStatus>("idle");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const bulk = useBulkSelect(items, (item) => item.id);

  // Fetch trash using .then() so setState is called in callbacks, not directly in effect body
  useEffect(() => {
    let cancelled = false;
    fetch("/api/paperless/trash/?page_size=200", { credentials: "include", cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TrashListResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.results) ? data.results : []);
        setLoadError(null);
        setLoadState("success");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setLoadError(err.message ?? "Erreur de chargement");
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [loadTick]);

  async function restore(ids: number[]) {
    if (ids.length === 0) return;
    setRestoreState("loading");
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await fetch("/api/paperless/trash/bulk-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ documentIds: ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setActionMessage(`${ids.length} document(s) restauré(s).`);
      setRestoreState("success");
      bulk.clearAll();
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de la restauration");
      setRestoreState("idle");
    }
  }

  async function deletePermanently(ids: number[]) {
    if (ids.length === 0) return;
    setDeleteState("loading");
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await fetch("/api/paperless/trash/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ documentIds: ids, confirm: "DELETE_PERMANENTLY" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; succeeded?: number };
      if (!res.ok || "error" in data) throw new Error(data.error ?? `HTTP ${res.status}`);
      setActionMessage(`${data.succeeded ?? ids.length} document(s) supprimé(s) définitivement.`);
      setDeleteState("success");
      bulk.clearAll();
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de la suppression");
      setDeleteState("idle");
    } finally {
      setConfirmDelete(false);
    }
  }

  async function emptyTrash() {
    setEmptyState("loading");
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await fetch("/api/paperless/trash/empty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ confirm: "EMPTY_TRASH" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; emptied?: number };
      if (!res.ok || "error" in data) throw new Error(data.error ?? `HTTP ${res.status}`);
      setActionMessage(`Corbeille vidée — ${data.emptied ?? 0} document(s) supprimé(s).`);
      setEmptyState("success");
      bulk.clearAll();
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors du vidage");
      setEmptyState("idle");
    } finally {
      setConfirmEmpty(false);
    }
  }

  const isWorking =
    restoreState === "loading" ||
    deleteState === "loading" ||
    emptyState === "loading" ||
    loadState === "loading";

  const selectedIds = [...bulk.selectedIds] as number[];

  if (loadState === "loading") {
    return (
      <div className="flex items-center gap-2 py-8 text-sm" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement de la corbeille…
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div
        className="rounded-xl border p-4 text-sm text-rose-700"
        style={{ borderColor: "#FCA5A5", background: "#FEF2F2" }}
      >
        <TriangleAlert className="mb-1 mr-1 inline h-4 w-4" />
        {loadError ?? "Impossible de charger la corbeille Gedify."}
        <button type="button" onClick={() => reload()} className="ml-3 underline">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barre d'actions globales */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => reload()}
            disabled={isWorking}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Actualiser
          </button>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmEmpty(true)}
              disabled={isWorking}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition hover:bg-rose-50 disabled:opacity-50"
              style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Vider la corbeille
            </button>
          )}
        </div>

        {actionMessage && (
          <p className="text-[13px] font-semibold" style={{ color: "#16A34A" }}>
            ✓ {actionMessage}
          </p>
        )}
        {actionError && (
          <p className="flex items-center gap-1 text-[13px] font-semibold text-rose-700">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {actionError}
          </p>
        )}
      </div>

      {/* Barre de sélection groupée */}
      {!bulk.isNoneSelected && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5"
          style={{ borderColor: "var(--blue-600)", background: "rgba(11,92,255,0.05)" }}
        >
          <span className="text-[13px] font-bold" style={{ color: "var(--blue-600)" }}>
            {bulk.selectedCount} sélectionné(s)
          </span>
          <button
            type="button"
            onClick={() => void restore(selectedIds)}
            disabled={isWorking}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition hover:bg-emerald-50 disabled:opacity-50"
            style={{ borderColor: "#6EE7B7", color: "#059669" }}
          >
            {restoreState === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Restaurer
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isWorking}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition hover:bg-rose-50 disabled:opacity-50"
            style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
          >
            {deleteState === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Supprimer définitivement
          </button>
          <button
            type="button"
            onClick={() => bulk.clearAll()}
            className="ml-auto text-[12px]"
            style={{ color: "var(--text-muted)" }}
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* Table */}
      {items.length === 0 ? (
        <div
          className="rounded-xl border p-8 text-center text-[14px]"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          La corbeille est vide.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr
                className="border-b text-left text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                  background: "var(--surface)",
                }}
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
                <th className="px-3 py-3">Titre</th>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Supprimé le</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b transition last:border-0"
                  style={{
                    borderColor: "var(--border)",
                    background: bulk.isSelected(item.id)
                      ? "rgba(11,92,255,0.04)"
                      : "var(--bg-main)",
                  }}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={bulk.isSelected(item.id)}
                      onChange={() => bulk.toggle(item.id)}
                      aria-label={`Sélectionner ${item.title}`}
                      className="h-4 w-4 rounded"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium" style={{ color: "var(--text-main)" }}>
                    {item.title || `Document #${item.id}`}
                  </td>
                  <td
                    className="px-3 py-3 font-mono text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    #{item.id}
                  </td>
                  <td className="px-3 py-3" style={{ color: "var(--text-muted)" }}>
                    {formatDate(item.deleted_at)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => void restore([item.id])}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition hover:bg-emerald-50 disabled:opacity-50"
                        style={{ borderColor: "#6EE7B7", color: "#059669" }}
                      >
                        <ArchiveRestore className="h-3 w-3" strokeWidth={1.75} />
                        Restaurer
                      </button>
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => {
                          bulk.clearAll();
                          bulk.toggle(item.id);
                          setConfirmDelete(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition hover:bg-rose-50 disabled:opacity-50"
                        style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modales de confirmation */}
      <ConfirmActionDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void deletePermanently(selectedIds)}
        variant="delete"
        title="Supprimer définitivement ?"
        description={`Cette action supprimera ${bulk.selectedCount} document(s) du moteur local et toutes les données GED associées. Irréversible.`}
        confirmLabel="Supprimer définitivement"
        requireTextConfirmation
        itemName="DELETE"
        loading={deleteState === "loading"}
      />

      <ConfirmActionDialog
        isOpen={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={() => void emptyTrash()}
        variant="delete"
        title="Vider la corbeille ?"
        description={`Cette action supprimera définitivement tous les ${items.length} document(s) de la corbeille Gedify ainsi que les données GED associées. Irréversible.`}
        confirmLabel="Vider la corbeille"
        requireTextConfirmation
        itemName="EMPTY_TRASH"
        loading={emptyState === "loading"}
      />
    </div>
  );
}
