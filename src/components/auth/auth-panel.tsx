"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";

/* Carte d'authentification : onglets Connexion / Inscription, branchée sur le
   système d'auth EXISTANT (/api/auth/login, /api/auth/signup). Aucune refonte
   de l'authentification : seule l'interface change. */

type Tab = "login" | "signup";

const fieldCls = "h-11 w-full rounded-xl border pl-10 pr-4 text-[14px] outline-none transition focus:ring-2";
const fieldStyle = { borderColor: "var(--border)", color: "var(--text-main)" } as const;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function AuthPanel({ next, signupOpen, oauthEnabled = false }: { next: string; signupOpen: boolean; oauthEnabled?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");

  return (
    <div className="rounded-3xl border bg-white p-6 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)] sm:p-7" style={{ borderColor: "var(--border)" }}>
      {/* Onglets */}
      <div role="tablist" aria-label="Authentification" className="mb-6 grid grid-cols-2 gap-2">
        {(["login", "signup"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t)}
              className="relative pb-2 text-center text-[15px] font-bold transition"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              {t === "login" ? "Connexion" : "Inscription"}
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: active ? "var(--accent)" : "transparent" }} />
            </button>
          );
        })}
      </div>

      {tab === "login" ? <LoginForm next={next} oauthEnabled={oauthEnabled} onRouter={router} /> : <SignupForm next={next} signupOpen={signupOpen} onRouter={router} onSwitchLogin={() => setTab("login")} />}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C" }} role="alert">
      <span className="mt-0.5 shrink-0" aria-hidden="true">⚠</span><span>{message}</span>
    </div>
  );
}

type RouterLike = ReturnType<typeof useRouter>;

function OAuthButtons({ enabled }: { enabled: boolean }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span className="text-[12px]" style={{ color: "var(--text-hint)" }}>ou</span>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>
      <button type="button" disabled={!enabled} title={enabled ? undefined : "Bientôt disponible"} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border text-[14px] font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
        <GoogleIcon /> Continuer avec Google {!enabled ? <span className="text-[11px] font-normal" style={{ color: "var(--text-hint)" }}>(bientôt)</span> : null}
      </button>
      <button type="button" disabled={!enabled} title={enabled ? undefined : "Bientôt disponible"} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border text-[14px] font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M16.37 12.78c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.1 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5ZM14.2 6.1c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.69-.92 2.69.97.08 1.97-.49 2.58-1.22Z" /></svg>
        Continuer avec Apple {!enabled ? <span className="text-[11px] font-normal" style={{ color: "var(--text-hint)" }}>(bientôt)</span> : null}
      </button>
    </div>
  );
}

function LoginForm({ next, oauthEnabled, onRouter }: { next: string; oauthEnabled: boolean; onRouter: RouterLike }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: email, password }) });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Identifiant ou mot de passe incorrect.");
        return;
      }
      onRouter.push(next);
      onRouter.refresh();
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <ErrorBox message={error} /> : null}
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>E-mail</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" className={fieldCls} style={fieldStyle} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="login-password" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Mot de passe</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input id="login-password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${fieldCls} pr-11`} style={fieldStyle} />
          <button type="button" tabIndex={-1} onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-70" style={{ color: "var(--text-hint)" }} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
            {show ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
          </button>
        </div>
        <div className="text-right">
          <a href="/login?reset=1" className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>Mot de passe oublié ?</a>
        </div>
      </div>
      <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-70" style={{ background: "var(--accent)" }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {loading ? "Connexion en cours…" : "Se connecter"}
      </button>
      <OAuthButtons enabled={oauthEnabled} />
    </form>
  );
}

function SignupForm({ next, signupOpen, onRouter, onSwitchLogin }: { next: string; signupOpen: boolean; onRouter: RouterLike; onSwitchLogin: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!signupOpen) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[14px]" style={{ color: "var(--text-main)" }}>L&apos;inscription publique est actuellement fermée.</p>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>L&apos;accès se fait <strong>sur invitation</strong>. Vous avez reçu une invitation ? Ouvrez le lien reçu par e-mail.</p>
        <a href="mailto:contact@gedify.fr?subject=Demande%20de%20démo%20Gedify" className="inline-flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>Demander une démo</a>
        <button type="button" onClick={onSwitchLogin} className="text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>J&apos;ai déjà un compte → Connexion</button>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Inscription impossible.");
        return;
      }
      onRouter.push(next);
      onRouter.refresh();
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <ErrorBox message={error} /> : null}
      <div className="space-y-1.5">
        <label htmlFor="su-name" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Nom complet</label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input id="su-name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" className={fieldCls} style={fieldStyle} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="su-email" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>E-mail professionnel</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" className={fieldCls} style={fieldStyle} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="su-password" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Mot de passe</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input id="su-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" className={fieldCls} style={fieldStyle} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="su-confirm" className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Confirmer le mot de passe</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          <input id="su-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={fieldCls} style={fieldStyle} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[14px] font-bold transition hover:bg-slate-50 disabled:opacity-70" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {loading ? "Création…" : "Créer mon compte"}
      </button>
      <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-hint)" }}>
        En créant un compte, vous acceptez les <a href="/cgu" className="font-semibold" style={{ color: "var(--accent)" }}>Conditions d&apos;utilisation</a> et la <a href="/confidentialite" className="font-semibold" style={{ color: "var(--accent)" }}>Politique de confidentialité</a>.
      </p>
    </form>
  );
}
