"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save, Trash2, XCircle } from "lucide-react";
import { FieldEditor, type FieldEditorDefinition } from "@/components/ui/field-editor";

type FormBuilderProps = {
  title?: string;
  description?: string;
  endpoint: string;
  method?: "POST" | "PATCH" | "PUT";
  deleteEndpoint?: string;
  initialValues?: Record<string, unknown>;
  fields: FieldEditorDefinition[];
  submitLabel?: string;
  successRedirect?: string;
  transform?: "custom-field" | "saved-view" | "storage-path" | "paperless-workflow" | "raw";
};

function parseJson(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function compactPayload(values: Record<string, unknown>, transform: FormBuilderProps["transform"]) {
  const payload = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== "" && value !== undefined)
  );

  if (transform === "custom-field") {
    return {
      name: payload.name,
      data_type: payload.data_type,
      extra_data: parseJson(payload.extra_data),
    };
  }

  if (transform === "saved-view") {
    return {
      name: payload.name,
      show_on_dashboard: Boolean(payload.show_on_dashboard),
      show_in_sidebar: Boolean(payload.show_in_sidebar),
      sort_field: payload.sort_field || null,
      sort_reverse: Boolean(payload.sort_reverse),
      filter_rules: parseJson(payload.filter_rules) ?? [],
      page_size: payload.page_size ? Number(payload.page_size) : null,
      display_mode: payload.display_mode || null,
    };
  }

  if (transform === "storage-path") {
    return {
      name: payload.name,
      path: payload.path,
      match: payload.match ?? "",
      matching_algorithm: Number(payload.matching_algorithm ?? 6),
      is_insensitive: Boolean(payload.is_insensitive),
    };
  }

  if (transform === "paperless-workflow") {
    return {
      name: payload.name,
      order: Number(payload.order ?? 0),
      enabled: Boolean(payload.enabled),
      triggers: parseJson(payload.triggers) ?? [],
      actions: parseJson(payload.actions) ?? [],
    };
  }

  return payload;
}

export function FormBuilder({
  title,
  description,
  endpoint,
  method = "POST",
  deleteEndpoint,
  initialValues = {},
  fields,
  submitLabel = "Enregistrer",
  successRedirect,
  transform = "raw",
}: FormBuilderProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compactPayload(values, transform)),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string; details?: string };

      if (!response.ok) {
        throw new Error(data.details || data.error || "Action impossible via l'API.");
      }

      setStatus("success");
      setMessage("Modification enregistrée.");
      router.refresh();

      if (successRedirect) {
        router.push(successRedirect);
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erreur inconnue.");
    }
  }

  async function deleteItem() {
    if (!deleteEndpoint) return;
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(deleteEndpoint, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(data.details || data.error || "Suppression indisponible via l'API.");
      }

      setStatus("success");
      setMessage("Élément supprimé.");
      router.refresh();
      router.push(successRedirect ?? "/dashboard");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erreur inconnue.");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm backdrop-blur">
      {title ? <h2 className="text-lg font-extrabold text-slate-950">{title}</h2> : null}
      {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className={field.type === "textarea" || field.type === "json" ? "md:col-span-2" : ""}>
            <FieldEditor
              field={field}
              value={values[field.name]}
              onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
            />
          </div>
        ))}
      </div>

      {message ? (
        <p
          className={`mt-5 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
            status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {status === "error" ? (
            <XCircle className="mt-0.5 h-4 w-4" strokeWidth={2} aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
          {message}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        {deleteEndpoint ? (
          <button
            type="button"
            onClick={deleteItem}
            disabled={status === "saving"}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Supprimer
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.35)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
        >
          {status === "saving" ? (
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
