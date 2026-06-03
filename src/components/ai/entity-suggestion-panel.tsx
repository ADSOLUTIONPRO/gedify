"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Tag,
  User,
  FileType2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AllEntitySuggestions, EntityMatch, EntitySuggestionStatus } from "@/lib/ai/entity-suggestions";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EntitySuggestionStatus, { label: string; className: string }> = {
  existing_match: {
    label: "Correspondance exacte",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  possible_match: {
    label: "Correspondance probable",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  new_entity: {
    label: "Nouvelle entité",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  uncertain: {
    label: "Incertain",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

function StatusBadge({ status }: { status: EntitySuggestionStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Create new entity inline form ────────────────────────────────────────────

function CreateEntityInline({
  defaultName,
  entityType,
  onCreated,
  onCancel,
}: {
  defaultName: string;
  entityType: "correspondent" | "tag" | "document_type";
  onCreated: (created: EntityMatch) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint =
    entityType === "correspondent"
      ? "/api/paperless/correspondents"
      : entityType === "tag"
        ? "/api/paperless/tags"
        : "/api/paperless/document-types";

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await res.json()) as { id?: number; name?: string; error?: string; details?: string };
      if (!res.ok) {
        if (res.status === 401) throw new Error("Session GED expirée — veuillez vous reconnecter.");
        throw new Error(data.error ?? data.details ?? `HTTP ${res.status}`);
      }
      onCreated({ id: data.id!, name: data.name ?? trimmed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); if (e.key === "Escape") onCancel(); }}
        className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        placeholder="Nom de la nouvelle entité"
        autoFocus
        disabled={busy}
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !name.trim()}
        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" /> : <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />}
        Créer
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-60"
      >
        <X className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
      </button>
      {error ? <span className="text-[11px] text-rose-600">{error}</span> : null}
    </div>
  );
}

// ─── Entity card ──────────────────────────────────────────────────────────────

type EntityCardProps = {
  icon: React.ElementType;
  label: string;
  suggestedName: string | null;
  status: EntitySuggestionStatus;
  existingMatch: EntityMatch | null;
  closeMatches: EntityMatch[];
  entityType: "correspondent" | "tag" | "document_type";
  documentId: number;
  currentTagIds?: number[];
  onApplied: () => void;
};

function EntityCard({
  icon: Icon,
  label,
  suggestedName,
  status,
  existingMatch,
  closeMatches,
  entityType,
  documentId,
  currentTagIds,
  onApplied,
}: EntityCardProps) {
  const [mode, setMode] = useState<"idle" | "selecting_close" | "creating">("idle");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [ignored, setIgnored] = useState(false);

  if (!suggestedName || status === "uncertain") return null;
  if (ignored) return null;

  async function applyEntity(entityId: number, name: string) {
    setBusy(true);
    setFeedback(null);
    try {
      let patch: Record<string, unknown>;
      if (entityType === "correspondent") {
        patch = { correspondent: entityId };
      } else if (entityType === "document_type") {
        patch = { document_type: entityId };
      } else {
        // tag: add to existing array
        const newTags = [...(currentTagIds ?? [])];
        if (!newTags.includes(entityId)) newTags.push(entityId);
        patch = { tags: newTags };
      }
      const res = await fetch(`/api/paperless/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Session GED expirée — veuillez vous reconnecter.");
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        throw new Error(data.error ?? data.details ?? `HTTP ${res.status}`);
      }
      setFeedback({ ok: true, message: `${name} appliqué.` });
      onApplied();
    } catch (err) {
      setFeedback({ ok: false, message: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  }

  const targetMatch = existingMatch;

  return (
    <div
      className="rounded-xl bg-white p-3"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(11,92,255,0.08)", color: "var(--blue-600)" }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
            <p className="truncate font-semibold text-slate-800">{suggestedName}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Match info */}
      {status === "existing_match" && targetMatch ? (
        <p className="mt-1.5 text-[11px] text-emerald-700">
          <CheckCircle2 className="mr-1 inline h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Correspond à « {targetMatch.name} » (#{targetMatch.id})
        </p>
      ) : null}

      {status === "possible_match" && closeMatches.length > 0 ? (
        <p className="mt-1.5 text-[11px] text-amber-700">
          <AlertTriangle className="mr-1 inline h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Ressemble à : {closeMatches.map((m) => `"${m.name}"`).join(", ")}
        </p>
      ) : null}

      {/* Actions */}
      {!feedback ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {status === "existing_match" && targetMatch ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyEntity(targetMatch.id, targetMatch.name)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 border border-emerald-200"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />}
              Utiliser l&apos;existant
            </button>
          ) : null}

          {status === "possible_match" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode(mode === "selecting_close" ? "idle" : "selecting_close")}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 border border-amber-200"
            >
              Choisir existant
              <ChevronDown className={`h-3 w-3 transition ${mode === "selecting_close" ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => setMode(mode === "creating" ? "idle" : "creating")}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 border border-blue-200"
          >
            <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Créer nouveau
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setIgnored(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 disabled:opacity-60"
          >
            <X className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Ignorer
          </button>
        </div>
      ) : (
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${feedback.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {feedback.ok
            ? <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            : <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          }
          {feedback.message}
        </div>
      )}

      {/* Close matches picker */}
      {mode === "selecting_close" && closeMatches.length > 0 ? (
        <div className="mt-2 space-y-1">
          {closeMatches.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={busy}
              onClick={() => { void applyEntity(m.id, m.name); setMode("idle"); }}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] transition hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="font-semibold text-slate-700">{m.name}</span>
              <span className="text-slate-400">#{m.id}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Create new inline */}
      {mode === "creating" ? (
        <CreateEntityInline
          defaultName={suggestedName}
          entityType={entityType}
          onCreated={(created) => {
            setMode("idle");
            void applyEntity(created.id, created.name);
          }}
          onCancel={() => setMode("idle")}
        />
      ) : null}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type Props = {
  documentId: number;
  currentTagIds?: number[];
};

export function EntitySuggestionPanel({
  documentId,
  currentTagIds = [],
}: Props) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<AllEntitySuggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ai/entity-suggestions/${documentId}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 401) {
            if (!cancelled) {
              setFetchError("Session expirée — veuillez vous reconnecter.");
              setLoading(false);
            }
            return;
          }
          if (res.status === 404) {
            if (!cancelled) { setSuggestions(null); setLoading(false); }
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as AllEntitySuggestions;
        if (!cancelled) { setSuggestions(data); setLoading(false); }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Erreur réseau");
          setLoading(false);
        }
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [documentId]);

  useEffect(() => {
    return load();
  }, [load]);

  function handleApplied() {
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
        Calcul des suggestions…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        {fetchError}
      </div>
    );
  }

  if (!suggestions) {
    return (
      <p className="text-sm text-slate-400">Aucune analyse IA disponible pour ce document.</p>
    );
  }

  const { correspondent, documentType, tags } = suggestions;
  const actionableTags = tags.filter((t) => t.status !== "uncertain");
  const hasAnySuggestion =
    (correspondent.status !== "uncertain" && correspondent.detectedName) ||
    (documentType.status !== "uncertain" && documentType.suggestedName) ||
    actionableTags.length > 0;

  if (!hasAnySuggestion) {
    return (
      <p className="text-sm text-slate-400">Aucune suggestion d&apos;entité pour ce document.</p>
    );
  }

  return (
    <div className="space-y-2">
      {correspondent.detectedName && correspondent.status !== "uncertain" ? (
        <EntityCard
          icon={User}
          label="Correspondant"
          suggestedName={correspondent.detectedName}
          status={correspondent.status === "new_correspondent" ? "new_entity" : correspondent.status as EntitySuggestionStatus}
          existingMatch={correspondent.existingMatch}
          closeMatches={correspondent.closeMatches}
          entityType="correspondent"
          documentId={documentId}
          onApplied={handleApplied}
        />
      ) : null}

      {documentType.suggestedName && documentType.status !== "uncertain" ? (
        <EntityCard
          icon={FileType2}
          label="Type de document"
          suggestedName={documentType.suggestedName}
          status={documentType.status}
          existingMatch={documentType.existingMatch}
          closeMatches={documentType.closeMatches}
          entityType="document_type"
          documentId={documentId}
          onApplied={handleApplied}
        />
      ) : null}

      {actionableTags.map((tag, i) => (
        <EntityCard
          key={`${tag.suggestedName}-${i}`}
          icon={Tag}
          label={`Tag suggéré`}
          suggestedName={tag.suggestedName}
          status={tag.status}
          existingMatch={tag.existingMatch}
          closeMatches={tag.closeMatches}
          entityType="tag"
          documentId={documentId}
          currentTagIds={currentTagIds}
          onApplied={handleApplied}
        />
      ))}
    </div>
  );
}
