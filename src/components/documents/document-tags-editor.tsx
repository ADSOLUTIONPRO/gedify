"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { AutocompleteInput, type AutocompleteSuggestion } from "@/components/ui/autocomplete-input";
import { BadgeTag } from "@/components/ui/badge-tag";
import { createTag, logChange, patchDocument } from "@/lib/documents/document-quick-edit";

type TagItem = { id: number; name: string; color?: string; text_color?: string };

type Props = {
  documentId: number;
  initialTags: TagItem[];
  user?: string | null;
  onSaved?: () => void;
  onStatus?: (s: string) => void;
};

/**
 * Multi-select de tags à chips, bâti sur `AutocompleteInput` : ajout d'un tag
 * existant, création (« Créer le tag »), retrait par chip. Chaque changement
 * PATCH le document Gedify (tags[]) + journalise.
 */
export function DocumentTagsEditor({ documentId, initialTags, user, onSaved, onStatus }: Props) {
  const [tags, setTags] = useState<TagItem[]>(initialTags);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  async function commit(next: TagItem[], changeLabel: string, oldV: string, newV: string) {
    setBusy(true);
    onStatus?.("Enregistrement…");
    const prev = tags;
    setTags(next);
    try {
      await patchDocument(documentId, { tags: next.map((t) => t.id) });
      await logChange(documentId, changeLabel, oldV, newV, user);
      onStatus?.("Enregistré");
      onSaved?.();
    } catch {
      setTags(prev);
      onStatus?.("Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  async function addExisting(s: AutocompleteSuggestion) {
    const id = Number(s.id);
    if (!Number.isFinite(id) || tags.some((t) => t.id === id)) {
      setQuery("");
      return;
    }
    const next = [...tags, { id, name: s.label }];
    setQuery("");
    await commit(next, "Tags", tags.map((t) => t.name).join(", ") || "Aucun", next.map((t) => t.name).join(", "));
  }

  async function addNew(name: string) {
    setBusy(true);
    onStatus?.("Création du tag…");
    try {
      const created = await createTag(name);
      const next = [...tags, { id: created.id, name: created.name }];
      setQuery("");
      onStatus?.("Tag créé");
      await commit(next, "Tags", tags.map((t) => t.name).join(", ") || "Aucun", next.map((t) => t.name).join(", "));
    } catch {
      onStatus?.("Création du tag impossible");
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const next = tags.filter((t) => t.id !== id);
    await commit(next, "Tags", tags.map((t) => t.name).join(", "), next.map((t) => t.name).join(", ") || "Aucun");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {tags.length === 0 ? (
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun tag</span>
        ) : (
          tags.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1">
              <BadgeTag tag={t} compact />
              <button
                type="button"
                onClick={() => void remove(t.id)}
                disabled={busy}
                aria-label={`Retirer ${t.name}`}
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          ))
        )}
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-hint)" }} aria-hidden="true" /> : null}
      </div>
      <AutocompleteInput
        endpoint="/api/autocomplete/tags"
        value={query}
        onChange={(value, suggestion) => {
          if (suggestion) void addExisting(suggestion);
          else setQuery(value);
        }}
        allowCreate
        onCreate={(name) => void addNew(name)}
        placeholder="Ajouter un tag…"
        disabled={busy}
      />
    </div>
  );
}
