"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown, Copy, Users } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   Aide à la configuration « BYO » de la synchro AGENDA + CONTACTS Google.

   L'email Gmail passe par IMAP (mot de passe d'application) ; l'agenda et les
   contacts requièrent OAuth avec VOTRE propre app Google. Cette carte affiche
   AUTOMATIQUEMENT l'URI de redirection exacte à coller dans Google Cloud Console
   (calculée depuis l'origine réelle du navigateur) + les étapes essentielles.
   Détails complets : docs/GOOGLE_CALENDAR_CONTACTS_SETUP.md.
   ──────────────────────────────────────────────────────────────────────── */
export function GoogleSyncSetupCard({ configured }: { configured?: boolean }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const redirectUri = origin ? `${origin}/api/connectors/gmail/callback` : "https://VOTRE-INSTANCE/api/connectors/gmail/callback";
  // Google refuse les URI non-HTTPS (sauf localhost) et les adresses IP : on alerte.
  const insecureOrigin = origin.startsWith("http://") && !/^http:\/\/localhost(?::|\/|$)/i.test(origin);

  async function copy() {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* presse-papiers indisponible */ }
  }

  return (
    <section className="rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <CalendarDays className="h-4.5 w-4.5" strokeWidth={1.85} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-extrabold" style={{ color: "var(--text-main)" }}>
            Synchroniser l&apos;agenda et les contacts Google
          </span>
          <span className="block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
            {configured ? "OAuth Google configuré · voici l'URI de redirection à enregistrer" : "Nécessite votre propre app Google (l'email reste en IMAP)"}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} style={{ color: "var(--text-hint)" }} aria-hidden="true" />
      </button>

      {open ? (
        <div className="space-y-3 border-t px-4 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
          <p className="text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
            L&apos;email Gmail se connecte sans OAuth (mot de passe d&apos;application). L&apos;agenda
            (Calendar API) et les contacts (People API) nécessitent OAuth avec votre propre app Google.
          </p>

          {/* URI de redirection (auto) */}
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>
              URI de redirection autorisée (à coller dans Google Cloud Console)
            </p>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border px-3 py-2 text-[12.5px]" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card-soft)", color: "var(--text-main)" }} title={redirectUri}>
                {redirectUri}
              </code>
              <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-bold transition hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)", color: copied ? "#15803D" : "var(--text-main)" }}>
                {copied ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Copy className="h-4 w-4" strokeWidth={1.85} />}
                {copied ? "Copié" : "Copier"}
              </button>
            </div>
            {insecureOrigin ? (
              <p className="mt-1.5 text-[11.5px] font-semibold" style={{ color: "#B45309" }}>
                ⚠️ Google exige une URL HTTPS avec un nom de domaine (pas d&apos;adresse IP ni de http://). Servez GEDify via votre reverse proxy HTTPS avant de configurer.
              </p>
            ) : null}
          </div>

          {/* Étapes condensées */}
          <ol className="space-y-1.5 text-[12.5px]" style={{ color: "var(--text-main)" }}>
            <Step n={1}><strong>console.cloud.google.com</strong> → activez <strong>People API</strong> + <strong>Calendar API</strong>.</Step>
            <Step n={2}>Écran de consentement OAuth (External) → scopes <code>calendar</code> + <code>contacts.readonly</code> → ajoutez-vous en <em>test user</em>.</Step>
            <Step n={3}>Credentials → OAuth client ID (<strong>Web</strong>) → collez l&apos;URI ci-dessus dans « Authorized redirect URIs ».</Step>
            <Step n={4}>Renseignez <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_REDIRECT_URI</code> (= l&apos;URI ci-dessus) et <code>GOOGLE_GMAIL_SCOPES</code> (calendar + contacts) dans <code>.env.local</code>, puis redémarrez.</Step>
            <Step n={5}>Ajouter une boîte → Continuer avec Google → <strong>« Se connecter avec Google (OAuth) »</strong>.</Step>
          </ol>

          <div className="flex items-center gap-3 rounded-xl border px-3 py-2 text-[11.5px]" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card-soft)", color: "var(--text-muted)" }}>
            <Users className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden="true" />
            <span>Procédure détaillée + remarque sur l&apos;expiration des jetons en mode « Testing » : <code>docs/GOOGLE_CALENDAR_CONTACTS_SETUP.md</code>.</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: "var(--accent)" }}>{n}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
