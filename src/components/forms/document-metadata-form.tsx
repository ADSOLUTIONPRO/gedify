"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toDateInputValue } from "@/lib/format";
import type {
  PaperlessCorrespondent,
  PaperlessDocument,
  PaperlessDocumentType,
  PaperlessTag,
} from "@/lib/paperless-types";

type DocumentMetadataFormProps = {
  document: PaperlessDocument;
  correspondents: PaperlessCorrespondent[];
  documentTypes: PaperlessDocumentType[];
  tags: PaperlessTag[];
};

function parseOptionalId(value: FormDataEntryValue | null) {
  if (!value || value === "") {
    return null;
  }

  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function DocumentMetadataForm({
  document,
  correspondents,
  documentTypes,
  tags,
}: DocumentMetadataFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const initialTags = useMemo(() => new Set(document.tags ?? []), [document.tags]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const selectedTags = formData
      .getAll("tags")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const payload = {
      title: getFormString(formData, "title"),
      correspondent: parseOptionalId(formData.get("correspondent")),
      document_type: parseOptionalId(formData.get("document_type")),
      tags: selectedTags,
      created: getFormString(formData, "created") || null,
      archive_serial_number: getFormString(formData, "archive_serial_number") || null,
    };
    const newNote = getFormString(formData, "new_note");

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(`/api/paperless/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string; details?: string };
        throw new Error(error.details || error.error || "Sauvegarde impossible.");
      }

      if (newNote) {
        const noteResponse = await fetch(`/api/paperless/documents/${document.id}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note: newNote }),
        });

        if (!noteResponse.ok) {
          const error = (await noteResponse.json()) as { error?: string; details?: string };
          throw new Error(error.details || error.error || "Note impossible à ajouter.");
        }
      }

      setStatus("success");
      setMessage("Métadonnées sauvegardées dans la GED.");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erreur inconnue.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="title">
          Titre
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={document.title}
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-medium outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-bold text-slate-700">Correspondant</span>
          <select
            name="correspondent"
            defaultValue={document.correspondent ?? ""}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-medium outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Non renseigné</option>
            {correspondents.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-2 block text-sm font-bold text-slate-700">Type de document</span>
          <select
            name="document_type"
            defaultValue={document.document_type ?? ""}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-medium outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Non renseigné</option>
            {documentTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-bold text-slate-700">Date du document</span>
          <input
            type="date"
            name="created"
            defaultValue={toDateInputValue(document.created)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-medium outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label>
          <span className="mb-2 block text-sm font-bold text-slate-700">Numéro d&apos;archive</span>
          <input
            name="archive_serial_number"
            inputMode="numeric"
            defaultValue={document.archive_serial_number ?? ""}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-medium outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 block text-sm font-bold text-slate-700">Tags</p>
        <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          {tags.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun tag disponible.</p>
          ) : (
            tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <input
                  type="checkbox"
                  name="tags"
                  value={tag.id}
                  defaultChecked={initialTags.has(tag.id)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                {tag.name}
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="new_note">
          Ajouter une note
        </label>
        <textarea
          id="new_note"
          name="new_note"
          rows={5}
          placeholder="Nouvelle note à ajouter au document"
          className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm font-medium outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
        />
      </div>

      {message ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm font-bold ${
            status === "error"
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "saving"}
        className="inline-flex h-11 items-center rounded-[20px] px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: "var(--accent)" }}
      >
        {status === "saving" ? "Sauvegarde..." : "Enregistrer"}
      </button>
    </form>
  );
}
