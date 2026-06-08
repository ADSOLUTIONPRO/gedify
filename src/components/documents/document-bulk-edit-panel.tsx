"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, FileText, FileType2, Info, Loader2, Tags, TriangleAlert, User, X } from "lucide-react";
import type { DocumentVM } from "@/components/documents/types";
import { EntityAutocomplete, type EntityOption } from "@/components/ui/entity-autocomplete";

/** Section façon Fiche Doc : carte blanche, titre majuscule avec icône. */
function BulkSection({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text-hint)" }}>
        <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" /> {title}
      </p>
      {children}
    </div>
  );
}

type Option = { id: number | string; name: string };
type TagOp = "keep" | "replace" | "add" | "remove" | "clear";
type FieldOp = "keep" | "replace" | "clear";

type Props = {
  selectedDocs: DocumentVM[];
  /** Conservés pour compat appelant — non utilisés (autocomplétion serveur). */
  correspondents?: Option[];
  types?: Option[];
  tags?: Option[];
  onClose: () => void;
  onSuccess: () => void;
};

type PatchState = {
  correspondentOp: FieldOp;
  correspondentOpt: EntityOption | null;
  typeOp: FieldOp;
  typeOpt: EntityOption | null;
  tagOp: TagOp;
  tagOptions: EntityOption[];
  createdOp: FieldOp;
  created: string;
  notesOp: FieldOp;
  notes: string;
};

const INITIAL: PatchState = {
  correspondentOp: "keep",
  correspondentOpt: null,
  typeOp: "keep",
  typeOpt: null,
  tagOp: "keep",
  tagOptions: [],
  createdOp: "keep",
  created: "",
  notesOp: "keep",
  notes: "",
};

function buildSummary(patch: PatchState): string[] {
  const lines: string[] = [];
  if (patch.correspondentOp === "replace") lines.push(`Correspondant → ${patch.correspondentOpt?.name ?? "—"}`);
  else if (patch.correspondentOp === "clear") lines.push("Correspondant → vider");
  if (patch.typeOp === "replace") lines.push(`Type → ${patch.typeOpt?.name ?? "—"}`);
  else if (patch.typeOp === "clear") lines.push("Type → vider");
  if (patch.tagOp === "replace") lines.push(`Tags → remplacer (${patch.tagOptions.length} tag(s))`);
  else if (patch.tagOp === "add") lines.push(`Tags → ajouter (${patch.tagOptions.length} tag(s))`);
  else if (patch.tagOp === "remove") lines.push(`Tags → retirer (${patch.tagOptions.length} tag(s))`);
  else if (patch.tagOp === "clear") lines.push("Tags → vider");
  if (patch.createdOp === "replace") lines.push(`Date document → ${patch.created}`);
  else if (patch.createdOp === "clear") lines.push("Date document → vider");
  if (patch.notesOp === "replace") lines.push(`Notes → modifier`);
  return lines;
}

export function DocumentBulkEditPanel({
  selectedDocs,
  onClose,
  onSuccess,
}: Props) {
  const [patch, setPatch] = useState<PatchState>(INITIAL);
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ updated: number; failed: number } | null>(null);

  const count = selectedDocs.length;
  const summary = buildSummary(patch);
  const hasChanges = summary.length > 0;

  function set<K extends keyof PatchState>(key: K, value: PatchState[K]) {
    setPatch((prev) => ({ ...prev, [key]: value }));
  }

  async function apply() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/documents/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentIds: selectedDocs.map((d) => d.id),
          patch: {
            // Ids RÉELS dérivés des options sélectionnées (jamais un libellé).
            correspondentId: patch.correspondentOpt ? Number(patch.correspondentOpt.id) : null,
            correspondentOp: patch.correspondentOp !== "keep" ? patch.correspondentOp : undefined,
            typeId: patch.typeOpt ? Number(patch.typeOpt.id) : null,
            typeOp: patch.typeOp !== "keep" ? patch.typeOp : undefined,
            tagIds: patch.tagOptions.map((o) => Number(o.id)),
            tagOp: patch.tagOp !== "keep" ? patch.tagOp : undefined,
            created: patch.created || null,
            createdOp: patch.createdOp !== "keep" ? patch.createdOp : undefined,
            notes: patch.notes,
            notesOp: patch.notesOp !== "keep" ? patch.notesOp : undefined,
          },
        }),
      });
      const data = (await res.json()) as { ok?: boolean; updated?: number; failed?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult({ updated: data.updated ?? 0, failed: data.failed ?? 0 });
      setStatus("success");
      setTimeout(onSuccess, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const opToggle = (label: string, op: FieldOp, onChange: (v: FieldOp) => void) => (
    <div className="flex gap-1.5">
      {(["keep", "replace", "clear"] as FieldOp[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className="rounded-md border px-2 py-0.5 text-[11px] font-semibold transition"
          style={{
            borderColor: op === v ? "var(--accent)" : "var(--border)",
            background: op === v ? "var(--accent-soft)" : "white",
            color: op === v ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {v === "keep" ? "Ne pas modifier" : v === "replace" ? "Remplacer" : "Vider"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative z-10 mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>
              Modifier les documents sélectionnés
            </h2>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {count} document{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100" style={{ color: "var(--text-muted)" }}>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5" style={{ background: "var(--bg-page)" }}>
          {status === "success" ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" strokeWidth={1.5} />
              <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
                {result?.updated ?? 0} document{(result?.updated ?? 0) > 1 ? "s" : ""} modifié{(result?.updated ?? 0) > 1 ? "s" : ""}
              </p>
              {(result?.failed ?? 0) > 0 && (
                <p className="mt-1 text-[12.5px] text-amber-700">{result?.failed} échec(s)</p>
              )}
            </div>
          ) : step === "confirm" ? (
            <div className="space-y-4">
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                Vous allez modifier <strong>{count} document{count > 1 ? "s" : ""}</strong> :
              </p>
              <ul className="space-y-1.5 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                {summary.map((line, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                    <span style={{ color: "var(--text-main)" }}>{line}</span>
                  </li>
                ))}
              </ul>
              {error && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-rose-700">
                  <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--gedify-info-soft)", color: "var(--gedify-info)" }}>
                <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" /> Seuls les champs explicitement activés seront modifiés.
              </p>

              <BulkSection icon={User} title="Correspondant">
                {opToggle("Correspondant", patch.correspondentOp, (v) => set("correspondentOp", v))}
                {patch.correspondentOp === "replace" && (
                  <div className="mt-2">
                    <EntityAutocomplete entityType="correspondent" allowCreate value={patch.correspondentOpt} onChange={(v) => set("correspondentOpt", (Array.isArray(v) ? v[0] : v) ?? null)} placeholder="Choisir ou créer un correspondant…" />
                  </div>
                )}
              </BulkSection>

              <BulkSection icon={FileType2} title="Type de document">
                {opToggle("Type", patch.typeOp, (v) => set("typeOp", v))}
                {patch.typeOp === "replace" && (
                  <div className="mt-2">
                    <EntityAutocomplete entityType="documentType" allowCreate value={patch.typeOpt} onChange={(v) => set("typeOpt", (Array.isArray(v) ? v[0] : v) ?? null)} placeholder="Choisir ou créer un type…" />
                  </div>
                )}
              </BulkSection>

              <BulkSection icon={Tags} title="Tags">
                <div className="flex flex-wrap gap-1.5">
                  {(["keep", "add", "remove", "replace", "clear"] as TagOp[]).map((v) => (
                    <button key={v} type="button" onClick={() => set("tagOp", v)} className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                      style={{ borderColor: patch.tagOp === v ? "var(--accent)" : "var(--border)", background: patch.tagOp === v ? "var(--accent-soft)" : "white", color: patch.tagOp === v ? "var(--accent)" : "var(--text-muted)" }}>
                      {v === "keep" ? "Ne pas modifier" : v === "add" ? "Ajouter" : v === "remove" ? "Retirer" : v === "replace" ? "Remplacer" : "Vider"}
                    </button>
                  ))}
                </div>
                {["add", "remove", "replace"].includes(patch.tagOp) && (
                  <div className="mt-2">
                    <EntityAutocomplete entityType="tag" multiple allowCreate={patch.tagOp !== "remove"} value={patch.tagOptions} onChange={(v) => set("tagOptions", Array.isArray(v) ? v : v ? [v] : [])} placeholder={patch.tagOp === "remove" ? "Tags à retirer…" : "Tags à ajouter ou créer…"} />
                  </div>
                )}
              </BulkSection>

              <BulkSection icon={CalendarDays} title="Date du document">
                {opToggle("Date", patch.createdOp, (v) => set("createdOp", v))}
                {patch.createdOp === "replace" && (
                  <input type="date" className="mt-2 h-9 w-full rounded-xl border px-2.5 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} value={patch.created} onChange={(e) => set("created", e.target.value)} />
                )}
              </BulkSection>

              <BulkSection icon={FileText} title="Notes">
                {opToggle("Notes", patch.notesOp, (v) => set("notesOp", v))}
                {patch.notesOp === "replace" && (
                  <textarea className="mt-2 w-full resize-none rounded-xl border px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} rows={3} value={patch.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Entrez les notes…" />
                )}
              </BulkSection>
            </div>
          )}
        </div>

        {/* Footer */}
        {status !== "success" && (
          <div className="flex justify-end gap-2 border-t p-4" style={{ borderColor: "var(--border)" }}>
            {step === "confirm" ? (
              <>
                <button type="button" onClick={() => setStep("edit")} className="rounded-xl border px-4 py-2 text-[13px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  Retour
                </button>
                <button
                  type="button"
                  disabled={status === "loading"}
                  onClick={() => void apply()}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Appliquer
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-[13px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={!hasChanges}
                  onClick={() => setStep("confirm")}
                  className="rounded-xl px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  Continuer ({count})
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
