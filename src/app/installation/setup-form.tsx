"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";

const inputCls =
  "h-11 w-full rounded-xl border pl-10 pr-4 text-[14px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export function SetupForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 3) {
      setError("L'identifiant doit contenir au moins 3 caractères.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        // App déjà initialisée → bascule vers la connexion.
        if (res.status === 409) {
          router.push("/login");
          return;
        }
        setError(data.error ?? "Création du compte impossible.");
        return;
      }
      // Session ouverte automatiquement → on entre dans l'app.
      router.push("/");
      router.refresh();
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]"
          style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C" }}
          role="alert"
        >
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Identifiant */}
      <div className="space-y-1.5">
        <label htmlFor="username" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
          Identifiant administrateur
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            disabled={disabled}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            className={inputCls}
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          />
        </div>
      </div>

      {/* Email (optionnel) */}
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
          Email <span style={{ color: "var(--text-hint)" }}>(facultatif)</span>
        </label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            disabled={disabled}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            className={inputCls}
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          />
        </div>
      </div>

      {/* Mot de passe */}
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
          Mot de passe <span style={{ color: "var(--text-hint)" }}>(8 caractères min.)</span>
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            disabled={disabled}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`${inputCls} pr-11`}
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-70"
            style={{ color: "var(--text-hint)" }}
            aria-label={showPassword ? "Masquer" : "Afficher"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {/* Confirmation */}
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
          Confirmer le mot de passe
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            disabled={disabled}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className={inputCls}
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || disabled}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-70"
        style={{ background: "var(--blue-600)" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {loading ? "Création en cours…" : "Créer le compte et entrer"}
      </button>
    </form>
  );
}
