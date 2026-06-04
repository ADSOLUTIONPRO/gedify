"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Merge, TriangleAlert } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type DupDoc = { id: number; title: string };
type DupGroup = { kind: "exact" | "probable"; reason: string; documents: DupDoc[] };

export function DuplicatesPanel() {
  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [keep, setKeep] = useState<Record<number, number>>({}); // index groupe → id maître
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/duplicates", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { groups?: DupGroup[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setGroups(data.groups ?? []);
      const init: Record<number, number> = {};
      (data.groups ?? []).forEach((g, i) => (init[i] = g.documents[0]?.id));
      setKeep(init);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const merge = useCallback(
    async (idx: number) => {
      const group = groups[idx];
      const keepId = keep[idx];
      if (!group || !keepId) return;
      const mergeIds = group.documents.map((d) => d.id).filter((id) => id !== keepId);
      setBusy(idx);
      setConfirmIdx(null);
      try {
        const res = await fetch("/api/admin/duplicates", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ keepId, mergeIds }),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
        if (!res.ok || data.error || !data.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`);
        setDone((d) => ({ ...d, [idx]: data.message ?? "Fusionné." }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setBusy(null);
      }
    },
    [groups, keep],
  );

  if (loading && groups.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="h-4 w-4 animate-spin" /> Analyse des doublons…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
          <TriangleAlert className="h-4 w-4" /> {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {groups.length} groupe(s) de doublons. La fusion garde le document choisi et envoie les autres à la corbeille (récupérables).
        </p>
        <button type="button" onClick={() => void load()} className="text-sm font-semibold text-blue-600 hover:underline">
          Rafraîchir
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun doublon détecté. 🎉</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((g, idx) => (
            <li key={idx} className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <Copy className="h-4 w-4 text-slate-400" />
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${g.kind === "exact" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                  {g.kind === "exact" ? "Exact" : "Probable"}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{g.reason}</span>
              </div>

              {done[idx] ? (
                <p className="text-[13px] font-semibold text-emerald-700">✓ {done[idx]}</p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    {g.documents.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 text-[13px]">
                        <input
                          type="radio"
                          name={`keep-${idx}`}
                          checked={keep[idx] === d.id}
                          onChange={() => setKeep((k) => ({ ...k, [idx]: d.id }))}
                          className="h-3.5 w-3.5"
                        />
                        <Link href={`/documents/${d.id}`} className="font-medium hover:text-blue-700" style={{ color: "var(--text-main)" }}>
                          #{d.id} — {d.title}
                        </Link>
                        {keep[idx] === d.id ? <span className="text-[10px] font-bold text-emerald-600">à conserver</span> : null}
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmIdx(idx)}
                    disabled={busy === idx}
                    className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--blue-600)" }}
                  >
                    {busy === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                    Fusionner (garder #{keep[idx]})
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmActionDialog
        isOpen={confirmIdx !== null}
        onClose={() => setConfirmIdx(null)}
        onConfirm={() => confirmIdx !== null && void merge(confirmIdx)}
        variant="warning"
        title="Fusionner ce groupe de doublons ?"
        description="Le document sélectionné est conservé (tags fusionnés, dossiers transférés). Les autres sont envoyés à la corbeille — récupérables, jamais supprimés définitivement."
        confirmLabel="Fusionner"
        loading={busy !== null}
      />
    </div>
  );
}
