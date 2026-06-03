import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, hint, required, htmlFor, error, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

type FormInputClassProps = {
  className?: string;
};

export function formInputClass({ className = "" }: FormInputClassProps = {}) {
  return `h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 ${className}`;
}
