"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Identifiant ou mot de passe incorrect.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Erreur */}
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

      {/* Identifiant Gedify */}
      <div className="space-y-1.5">
        <label htmlFor="username" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
          Adresse email
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--text-hint)" }}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            id="username"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="vous@exemple.com"
            className="h-11 w-full rounded-xl border pl-10 pr-4 text-[14px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          />
        </div>
      </div>

      {/* Mot de passe */}
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
          Mot de passe
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--text-hint)" }}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border pl-10 pr-11 text-[14px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
            {showPassword ? (
              <EyeOff className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Bouton */}
      <button
        type="submit"
        disabled={loading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-70"
        style={{ background: "var(--blue-600)" }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        {loading ? "Connexion en cours…" : "Se connecter"}
      </button>

      <p className="text-center text-[11.5px]" style={{ color: "var(--text-hint)" }}>
        Utilisez vos identifiants pour accéder à la GED.
      </p>
    </form>
  );
}
