"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";

type FieldProps = {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  onChange: (v: string) => void;
};

function PasswordField({ id, label, value, autoComplete, onChange }: FieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
        {label}
      </label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--text-hint)" }}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="h-11 w-full rounded-xl border pl-10 pr-11 text-[14px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-70"
          style={{ color: "var(--text-hint)" }}
          aria-label={show ? "Masquer" : "Afficher"}
        >
          {show ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Impossible de modifier le mot de passe.");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--border)" }}>
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-4 w-4" strokeWidth={1.85} style={{ color: "var(--accent)" }} aria-hidden="true" />
        <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>
          Modifier le mot de passe
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        {error ? (
          <div
            className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]"
            style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C" }}
            role="alert"
          >
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div
            className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]"
            style={{ borderColor: "#86EFAC", background: "#F0FDF4", color: "#15803D" }}
            role="status"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>Mot de passe modifié avec succès.</span>
          </div>
        ) : null}

        <PasswordField
          id="currentPassword"
          label="Mot de passe actuel"
          value={currentPassword}
          autoComplete="current-password"
          onChange={setCurrentPassword}
        />
        <PasswordField
          id="newPassword"
          label="Nouveau mot de passe"
          value={newPassword}
          autoComplete="new-password"
          onChange={setNewPassword}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirmer le nouveau mot de passe"
          value={confirmPassword}
          autoComplete="new-password"
          onChange={setConfirmPassword}
        />

        <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>
          Au moins 8 caractères. Vous resterez connecté après le changement.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-[14px] font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-70"
          style={{ background: "var(--blue-600)" }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {loading ? "Modification…" : "Modifier le mot de passe"}
        </button>
      </form>
    </section>
  );
}
