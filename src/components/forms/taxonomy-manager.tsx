"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Inbox,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormCard } from "@/components/ui/form-card";
import { FormField, formInputClass } from "@/components/ui/form-field";
import { SuggestionChips } from "@/components/ui/suggestion-chips";

type TaxonomyEntity = {
  id: number;
  name: string;
  color?: string;
  text_color?: string;
  document_count?: number;
  user_can_change?: boolean;
};

type TaxonomyManagerProps = {
  items: TaxonomyEntity[];
  apiBase: string;
  detailBase: string;
  paperlessOriginalBase?: string;
  documentParam: "correspondent" | "document_type" | "tag";
  noun: string;
  nounPlural?: string;
  inputPlaceholder?: string;
  suggestions?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  colorEnabled?: boolean;
};

type StatusState = "idle" | "saving" | "error" | "success";

export function TaxonomyManager({
  items,
  apiBase,
  detailBase,
  paperlessOriginalBase,
  documentParam,
  noun,
  nounPlural,
  inputPlaceholder,
  suggestions = [],
  emptyTitle,
  emptyDescription,
  colorEnabled = false,
}: TaxonomyManagerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [status, setStatus] = useState<StatusState>("idle");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TaxonomyEntity | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pluralNoun = nounPlural ?? `${noun}s`;
  const existingNames = useMemo(
    () => new Set(items.map((item) => item.name.toLowerCase())),
    [items],
  );

  const unusedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => !existingNames.has(suggestion.toLowerCase())),
    [suggestions, existingNames],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return items;
    return items.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [items, query]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setColor("#3b82f6");
  }

  function startEdit(item: TaxonomyEntity) {
    setEditingId(item.id);
    setName(item.name);
    setColor(item.color || "#3b82f6");
    setMessage("");
    setStatus("idle");
  }

  function pickSuggestion(value: string) {
    setName(value);
    setEditingId(null);
    setMessage("");
    setStatus("idle");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Le nom est obligatoire.");
      return;
    }

    const payload: Record<string, string> = { name: trimmed };
    if (colorEnabled) payload.color = color;

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(editingId ? `${apiBase}/${editingId}` : apiBase, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string; details?: string };
        throw new Error(error.details || error.error || "Action impossible.");
      }

      setStatus("success");
      setMessage(
        editingId
          ? `« ${trimmed} » modifié.`
          : `« ${trimmed} » créé. Vous pouvez maintenant l'utiliser pour classer vos documents.`,
      );
      resetForm();
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erreur inconnue.");
    }
  }

  async function confirmRemove() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`${apiBase}/${pendingDelete.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const error = (await response.json()) as { error?: string; details?: string };
        throw new Error(error.details || error.error || "Suppression impossible.");
      }
      setStatus("success");
      setMessage(`« ${pendingDelete.name} » supprimé.`);
      setPendingDelete(null);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erreur inconnue.");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
      <aside className="space-y-4">
        <FormCard
          icon={editingId ? Pencil : Plus}
          title={editingId ? `Modifier le ${noun}` : `Créer un ${noun}`}
          description={
            editingId
              ? `Mettez à jour le nom${colorEnabled ? " ou la couleur" : ""} de votre ${noun}.`
              : `Ajoutez un nouveau ${noun} à votre ancien classement.`
          }
        >
          <form onSubmit={submit} className="space-y-4">
            <FormField
              htmlFor={`taxonomy-${noun}-name`}
              label="Nom"
              required
              hint={`Le nom apparaîtra sur tous les documents associés.`}
            >
              <input
                id={`taxonomy-${noun}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={inputPlaceholder ?? `Ex. nom du ${noun}`}
                autoComplete="off"
                className={formInputClass()}
              />
            </FormField>

            {colorEnabled ? (
              <FormField label="Couleur" hint="La couleur du badge sur les documents.">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="h-11 w-16 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                  />
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-black/5"
                    style={{ backgroundColor: color, color: "#fff" }}
                  >
                    {name || "Aperçu du tag"}
                  </span>
                </div>
              </FormField>
            ) : null}

            {message ? (
              <p
                role="status"
                className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                  status === "error"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {status === "error" ? (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                )}
                <span>{message}</span>
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={status === "saving"}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--accent)" }}
              >
                {status === "saving"
                  ? "Enregistrement..."
                  : editingId
                    ? "Sauvegarder"
                    : `Créer ${noun}`}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
              ) : null}
            </div>
          </form>
        </FormCard>

        {unusedSuggestions.length > 0 && !editingId ? (
          <div className="rounded-[18px] bg-white p-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <SuggestionChips
              label="Suggestions rapides"
              suggestions={unusedSuggestions}
              onPick={pickSuggestion}
            />
            <p className="mt-3 text-xs text-slate-500">
              Cliquez sur une suggestion pour la pré-remplir, puis « Créer {noun} ».
            </p>
          </div>
        ) : null}
      </aside>

      <section className="rounded-[18px] bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="border-b p-5" style={{ borderColor: "var(--border-soft)" }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold tracking-tight text-slate-900">
                {pluralNoun.charAt(0).toUpperCase() + pluralNoun.slice(1)} existants
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {filteredItems.length} sur {items.length} affiché(s)
              </p>
            </div>
            <div className="relative flex h-11 w-full max-w-xs items-center md:w-72">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
                strokeWidth={1.75}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Rechercher un ${noun}...`}
                className="h-full w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[#FDE7EF]"
              />
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Inbox}
                title={emptyTitle ?? `Aucun ${noun} pour le moment`}
                description={
                  emptyDescription ??
                  `Commencez par créer votre premier ${noun}. Les suggestions ci-contre couvrent les cas les plus fréquents.`
                }
              />
              {unusedSuggestions.length > 0 ? (
                <div className="mx-auto mt-4 max-w-md">
                  <SuggestionChips
                    label="Suggestions à créer"
                    suggestions={unusedSuggestions}
                    onPick={pickSuggestion}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={Search}
                title="Aucun résultat"
                description={`Aucun ${noun} ne correspond à « ${query} ». Essayez un autre mot-clé.`}
              />
            </div>
          )
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className="grid gap-3 p-4 transition hover:bg-slate-50/60 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {colorEnabled ? (
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 rounded-full ring-2 ring-white shadow"
                        style={{ backgroundColor: item.color || "#94a3b8" }}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 items-center justify-center rounded-lg"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        <Tag className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    )}
                    <Link
                      href={`${detailBase}/${item.id}`}
                      className="break-words text-base font-bold hover:opacity-70"
                      style={{ color: "var(--gedify-navy)" }}
                    >
                      {item.name}
                    </Link>
                    {item.user_can_change === false ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Lecture seule
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <FileText className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    {item.document_count ?? 0} document(s) associé(s)
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 md:justify-end">
                  <Link
                    href={`/documents?${documentParam}=${item.id}`}
                    title="Voir les documents"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Documents
                    <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                  </Link>
                  {paperlessOriginalBase ? (
                    <a
                      href={`${paperlessOriginalBase}/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Ouvrir le document"
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    disabled={item.user_can_change === false}
                    title="Modifier"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: "var(--gedify-navy)" }}
                  >
                    <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(item)}
                    disabled={item.user_can_change === false}
                    title="Supprimer"
                    className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-2.5 text-xs font-semibold transition hover:bg-[var(--gedify-red-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ borderColor: "rgba(239,68,68,0.3)", color: "#DC2626" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmActionDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmRemove}
        variant="delete"
        title={`Supprimer « ${pendingDelete?.name ?? ""} » ?`}
        description={
          pendingDelete?.document_count
            ? `Ce ${noun} est associé à ${pendingDelete.document_count} document(s). La suppression retirera le ${noun} de ces documents.`
            : `La suppression est irréversible.`
        }
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}
