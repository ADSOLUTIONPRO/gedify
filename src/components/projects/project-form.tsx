"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FolderPlus, Loader2, Save, XCircle } from "lucide-react";
import { FormCard } from "@/components/ui/form-card";
import type {
  PaperlessCorrespondent,
  PaperlessDocumentType,
  PaperlessTag,
} from "@/lib/paperless-types";
import type {
  ProjectCategory,
  ProjectFolder,
  ProjectPriority,
  ProjectStatus,
} from "@/lib/projects/project-types";
import {
  PROJECT_CATEGORIES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
} from "@/lib/projects/project-types";

type ProjectFormProps = {
  mode: "create" | "edit";
  project?: ProjectFolder;
  correspondents: PaperlessCorrespondent[];
  tags: PaperlessTag[];
  types: PaperlessDocumentType[];
  /** Dossier parent (création d'un sous-dossier). */
  parentId?: string | null;
  parentName?: string | null;
};

type ProjectFormState = {
  name: string;
  description: string;
  category: ProjectCategory;
  status: ProjectStatus;
  priority: ProjectPriority;
  color: string;
  icon: string;
  openedAt: string;
  dueDate: string;
  notes: string;
  linkedCorrespondentIds: number[];
  linkedTagIds: number[];
  linkedDocumentTypeIds: number[];
  syncWithPaperlessTag: boolean;
};

const FIELD_CLASS =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
const TEXTAREA_CLASS =
  "min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";

const SUGGESTIONS = [
  "Vente maison",
  "Divorce",
  "Litige employeur",
  "Impôts 2025",
  "Travaux toiture",
  "Santé",
  "CAF",
  "Assurance",
];

function idsFromEvent(options: HTMLOptionsCollection) {
  return Array.from(options)
    .filter((option) => option.selected)
    .map((option) => Number(option.value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function initialState(project?: ProjectFolder): ProjectFormState {
  return {
    name: project?.name ?? "",
    description: project?.description ?? "",
    category: project?.category ?? "Administratif",
    status: project?.status ?? "En cours",
    priority: project?.priority ?? "Normale",
    color: project?.color ?? "#2563eb",
    icon: project?.icon ?? "folder-kanban",
    openedAt: project?.openedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dueDate: project?.dueDate?.slice(0, 10) ?? "",
    notes: project?.notes ?? "",
    linkedCorrespondentIds: project?.linkedCorrespondentIds ?? [],
    linkedTagIds: project?.linkedTagIds ?? [],
    linkedDocumentTypeIds: project?.linkedDocumentTypeIds ?? [],
    syncWithPaperlessTag: project?.syncWithPaperlessTag ?? false,
  };
}

function MultiSelect({
  label,
  help,
  options,
  value,
  onChange,
}: {
  label: string;
  help: string;
  options: Array<{ id: number; name: string }>;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <label>
      <span className={LABEL_CLASS}>{label}</span>
      <select
        multiple
        value={value.map(String)}
        onChange={(event) => onChange(idsFromEvent(event.currentTarget.options))}
        className="min-h-36 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{help}</span>
    </label>
  );
}

export function ProjectForm({
  mode,
  project,
  correspondents,
  tags,
  types,
  parentId = null,
  parentName = null,
}: ProjectFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProjectFormState>(() => initialState(project));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const endpoint = mode === "create" ? "/api/projects" : `/api/projects/${project?.id}`;
  const method = mode === "create" ? "POST" : "PATCH";
  const submitLabel = mode === "create" ? "Créer le dossier" : "Enregistrer";
  const title = mode === "create" ? "Nouveau dossier" : "Modifier le dossier";

  const canSubmit = useMemo(() => form.name.trim().length >= 2, [form.name]);

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canSubmit) {
      setError("Le nom du dossier doit contenir au moins 2 caractères.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dueDate: form.dueDate || null,
          openedAt: form.openedAt || null,
          ...(mode === "create" && parentId ? { parentId } : {}),
        }),
      });

      const data = (await response.json()) as ProjectFolder | { error?: string; details?: string };

      if (!response.ok) {
        throw new Error("details" in data ? data.details || data.error : "Erreur API interne");
      }

      const savedProject = data as ProjectFolder;
      setSuccess(mode === "create" ? "Dossier créé." : "Dossier mis à jour.");
      router.refresh();
      router.push(`/dossiers/${savedProject.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erreur inconnue pendant l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitForm} className="space-y-6">
      <FormCard
        icon={FolderPlus}
        title={title}
        description="Ces informations appartiennent à la GED AzServer. Les documents restent stockés dans la GED."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {parentName ? (
            <p className="lg:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-2.5 text-sm font-semibold text-blue-900">
              Sous-dossier de : <span className="font-extrabold">{parentName}</span>
            </p>
          ) : null}
          <label className="lg:col-span-2">
            <span className={LABEL_CLASS}>Nom du dossier</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className={FIELD_CLASS}
              placeholder="Exemple : Vente maison"
              required
            />
          </label>

          <label className="lg:col-span-2">
            <span className={LABEL_CLASS}>Description</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              className={TEXTAREA_CLASS}
              placeholder="Objectif, contexte, parties prenantes, documents attendus..."
            />
          </label>

          <label>
            <span className={LABEL_CLASS}>Catégorie</span>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as ProjectCategory,
                }))
              }
              className={FIELD_CLASS}
            >
              {PROJECT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={LABEL_CLASS}>Statut</span>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as ProjectStatus }))
              }
              className={FIELD_CLASS}
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={LABEL_CLASS}>Priorité</span>
            <select
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority: event.target.value as ProjectPriority,
                }))
              }
              className={FIELD_CLASS}
            >
              {PROJECT_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
            <label>
              <span className={LABEL_CLASS}>Couleur</span>
              <input
                type="color"
                value={form.color}
                onChange={(event) =>
                  setForm((current) => ({ ...current, color: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white p-1.5"
              />
            </label>
            <label>
              <span className={LABEL_CLASS}>Icône</span>
              <input
                value={form.icon}
                onChange={(event) =>
                  setForm((current) => ({ ...current, icon: event.target.value }))
                }
                className={FIELD_CLASS}
                placeholder="folder-kanban"
              />
            </label>
          </div>

          <label>
            <span className={LABEL_CLASS}>Date d’ouverture</span>
            <input
              type="date"
              value={form.openedAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, openedAt: event.target.value }))
              }
              className={FIELD_CLASS}
            />
          </label>

          <label>
            <span className={LABEL_CLASS}>Date d’échéance</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, dueDate: event.target.value }))
              }
              className={FIELD_CLASS}
            />
          </label>

          <label className="lg:col-span-2">
            <span className={LABEL_CLASS}>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className={TEXTAREA_CLASS}
              placeholder="Points importants, échéances, décisions, montants à suivre..."
            />
          </label>
        </div>
      </FormCard>

      <FormCard
        title="Liens Gedify"
        description="Associez le dossier à des correspondants, tags ou types existants dans la GED."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <MultiSelect
            label="Correspondants liés"
            help="Maintenez Cmd/Ctrl pour sélectionner plusieurs lignes."
            options={correspondents}
            value={form.linkedCorrespondentIds}
            onChange={(ids) => setForm((current) => ({ ...current, linkedCorrespondentIds: ids }))}
          />
          <MultiSelect
            label="Tags liés"
            help="Liens GED AzServer, sans modifier les documents Gedify."
            options={tags}
            value={form.linkedTagIds}
            onChange={(ids) => setForm((current) => ({ ...current, linkedTagIds: ids }))}
          />
          <MultiSelect
            label="Types liés"
            help="Utile pour retrouver les pièces attendues dans le dossier."
            options={types}
            value={form.linkedDocumentTypeIds}
            onChange={(ids) => setForm((current) => ({ ...current, linkedDocumentTypeIds: ids }))}
          />
        </div>

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.syncWithPaperlessTag}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  syncWithPaperlessTag: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-extrabold text-blue-950">
                Synchroniser avec un tag Gedify
              </span>
              <span className="mt-1 block text-sm leading-6 text-blue-800/80">
                Si activé, GED AzServer crée ou réutilise un tag Gedify nommé “Dossier -{" "}
                {form.name || "Nom du dossier"}” et l’applique aux documents liés. Sinon, les
                liaisons restent uniquement dans Gedify.
              </span>
            </span>
          </label>
        </div>
      </FormCard>

      <FormCard title="Suggestions de dossiers">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setForm((current) => ({ ...current, name: suggestion }))}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </FormCard>

      {error ? (
        <p className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <XCircle className="mt-0.5 h-4 w-4" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4" strokeWidth={2} aria-hidden="true" />
          {success}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="submit"
          disabled={!canSubmit || saving}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
