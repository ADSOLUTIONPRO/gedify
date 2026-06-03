"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type {
  PaperlessCorrespondent,
  PaperlessDocument,
  PaperlessDocumentType,
  PaperlessTag,
} from "@/lib/paperless-types";

type TreatmentWorkbenchProps = {
  documents: PaperlessDocument[];
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

export function TreatmentWorkbench({
  documents,
  correspondents,
  documentTypes,
  tags,
}: TreatmentWorkbenchProps) {
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const visibleDocuments = documents.filter((document) => !hiddenIds.includes(document.id));

  async function submit(event: FormEvent<HTMLFormElement>, document: PaperlessDocument) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const selectedTags = formData
      .getAll("tags")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    setPendingId(document.id);
    setMessage("");

    try {
      const response = await fetch(`/api/paperless/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: document.title,
          correspondent: parseOptionalId(formData.get("correspondent")),
          document_type: parseOptionalId(formData.get("document_type")),
          tags: selectedTags,
          created: document.created ?? null,
          archive_serial_number: document.archive_serial_number ?? null,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string; details?: string };
        throw new Error(error.details || error.error || "Validation impossible.");
      }

      setHiddenIds((current) => [...current, document.id]);
      setMessage(`Document #${document.id} validé.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur inconnue.");
    } finally {
      setPendingId(null);
    }
  }

  if (visibleDocuments.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-black text-emerald-900">Aucun document à traiter dans ce lot.</p>
        <p className="mt-2 text-sm text-emerald-700">
          Les documents visibles ont été validés ou aucun document incomplet n&apos;a été trouvé.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700">
          {message}
        </div>
      ) : null}

      {visibleDocuments.map((document) => {
        const documentTagIds = new Set(document.tags ?? []);

        return (
          <form
            key={document.id}
            onSubmit={(event) => submit(event, document)}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <Link
                  href={`/documents/${document.id}`}
                  className="text-lg font-black text-slate-950 hover:text-blue-700"
                >
                  {document.title || `Document #${document.id}`}
                </Link>
                <p className="mt-1 text-sm text-slate-500">Document #{document.id}</p>
              </div>
              <Link
                href={`/documents/${document.id}`}
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700"
              >
                Détail
              </Link>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                <span className="mb-2 block text-sm font-bold text-slate-700">Type</span>
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

            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-slate-700">Tags</p>
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    <input
                      type="checkbox"
                      name="tags"
                      value={tag.id}
                      defaultChecked={documentTagIds.has(tag.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-700"
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pendingId === document.id}
                className="inline-flex h-11 items-center rounded-lg bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {pendingId === document.id ? "Validation..." : "Valider"}
              </button>
              <button
                type="button"
                onClick={() => setHiddenIds((current) => [...current, document.id])}
                className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700"
              >
                Passer au suivant
              </button>
            </div>
          </form>
        );
      })}
    </div>
  );
}
