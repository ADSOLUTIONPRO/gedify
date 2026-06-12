import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes } from "react";

/* Primitives de formulaire du design system Admin (classes .au-*).
   Objectif n°1 : des champs TOUJOURS visibles (bordure, hauteur, focus). */

export function AdminField({ label, htmlFor, hint, error, required, children }: {
  label?: string; htmlFor?: string; hint?: string; error?: string; required?: boolean; children: ReactNode;
}) {
  return (
    <div className={`au-field${error ? " au-field--error" : ""}`}>
      {label ? <label className="au-label" htmlFor={htmlFor}>{label}{required ? <span className="au-req">*</span> : null}</label> : null}
      {children}
      {error ? <span className="au-error">{error}</span> : hint ? <span className="au-hint">{hint}</span> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string };
export function AdminInput({ label, hint, error, required, id, className = "", ...rest }: InputProps) {
  const input = <input id={id} className={`au-input ${className}`} required={required} {...rest} />;
  return label ? <AdminField label={label} htmlFor={id} hint={hint} error={error} required={required}>{input}</AdminField> : input;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string; error?: string };
export function AdminSelect({ label, hint, error, required, id, className = "", children, ...rest }: SelectProps) {
  const select = <select id={id} className={`au-select ${className}`} required={required} {...rest}>{children}</select>;
  return label ? <AdminField label={label} htmlFor={id} hint={hint} error={error} required={required}>{select}</AdminField> : select;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string; error?: string };
export function AdminTextarea({ label, hint, error, required, id, className = "", rows = 4, ...rest }: TextareaProps) {
  const ta = <textarea id={id} rows={rows} className={`au-textarea ${className}`} required={required} {...rest} />;
  return label ? <AdminField label={label} htmlFor={id} hint={hint} error={error} required={required}>{ta}</AdminField> : ta;
}

export function AdminCheckbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return <label className="au-checkbox"><input type="checkbox" {...rest} /><span>{label}</span></label>;
}

/** Interrupteur on/off. Pour un submit serveur, fournir `name` + `value="1"`. */
export function AdminSwitch({ label, name, defaultChecked, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className="au-switch">
      <input type="checkbox" name={name} value="1" defaultChecked={defaultChecked} {...rest} />
      <span className="au-switch-track" aria-hidden="true" />
      {label ? <span className="au-label" style={{ fontWeight: 600 }}>{label}</span> : null}
    </label>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function AdminButton({ variant = "primary", sm, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; sm?: boolean }) {
  return <button className={`au-btn au-btn--${variant}${sm ? " au-btn--sm" : ""} ${className}`} {...rest}>{children}</button>;
}

/** Section de formulaire (grille 1/2/3 colonnes responsive). */
export function AdminFormSection({ columns = 2, children, className = "" }: { columns?: 1 | 2 | 3; children: ReactNode; className?: string }) {
  return <div className={`au-form-section ${columns > 1 ? `au-grid au-grid--${columns}` : ""} ${className}`}>{children}</div>;
}

/** Barre d'actions collante en bas d'un formulaire long. */
export function AdminFormActions({ children }: { children: ReactNode }) {
  return <div className="au-form-actions">{children}</div>;
}
