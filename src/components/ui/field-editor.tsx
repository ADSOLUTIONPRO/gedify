"use client";

export type FieldEditorType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "json";

export type FieldEditorOption = {
  label: string;
  value: string | number;
};

export type FieldEditorDefinition = {
  name: string;
  label: string;
  type: FieldEditorType;
  help?: string;
  required?: boolean;
  options?: FieldEditorOption[];
  placeholder?: string;
};

type FieldEditorProps = {
  field: FieldEditorDefinition;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
};

const INPUT_CLASS =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
const TEXTAREA_CLASS =
  "min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

export function FieldEditor({ field, value, onChange }: FieldEditorProps) {
  return (
    <label className={field.type === "checkbox" ? "flex items-start gap-3" : "block"}>
      {field.type === "checkbox" ? (
        <>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(field.name, event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="block text-sm font-extrabold text-slate-900">{field.label}</span>
            {field.help ? (
              <span className="mt-1 block text-xs leading-5 text-slate-500">{field.help}</span>
            ) : null}
          </span>
        </>
      ) : (
        <>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            {field.label}
          </span>
          {field.type === "textarea" || field.type === "json" ? (
            <textarea
              required={field.required}
              value={typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2)}
              onChange={(event) => onChange(field.name, event.target.value)}
              placeholder={field.placeholder}
              className={TEXTAREA_CLASS}
            />
          ) : field.type === "select" ? (
            <select
              required={field.required}
              value={String(value ?? "")}
              onChange={(event) => onChange(field.name, event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Sélectionner</option>
              {(field.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              required={field.required}
              value={String(value ?? "")}
              onChange={(event) =>
                onChange(
                  field.name,
                  field.type === "number" ? Number(event.target.value) : event.target.value
                )
              }
              placeholder={field.placeholder}
              className={INPUT_CLASS}
            />
          )}
          {field.help ? <span className="mt-1 block text-xs leading-5 text-slate-500">{field.help}</span> : null}
        </>
      )}
    </label>
  );
}
