import { ExternalLink, FileText, Lock, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { AuthPanel } from "./auth-panel";
import { TrustBadges } from "./trust-badges";
import { HeroProductMockup } from "./hero-product-mockup";

/* Page d'accueil / authentification premium (split-screen). Enveloppe l'auth
   EXISTANTE — aucune logique d'authentification n'est réécrite ici. */

const HERO_BADGES = [
  { icon: FileText, title: "Factures & papiers", sub: "Classez maison & activité" },
  { icon: Lock, title: "Sécurisé & conforme", sub: "Hébergé en France · RGPD" },
  { icon: Sparkles, title: "IA & OCR avancés", sub: "Productivité boostée" },
];

export function SaasAuthLanding({
  next, signupOpen, oauthEnabled = false, showAuthMessage = false,
}: { next: string; signupOpen: boolean; oauthEnabled?: boolean; showAuthMessage?: boolean }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* ── Partie gauche : claire, formulaire ── */}
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14" style={{ background: "var(--bg-page)" }}>
        <div className="mx-auto w-full max-w-[460px]">
          <div className="mb-7 flex items-center gap-2">
            <BrandLogo variant="full" className="h-9 w-auto" />
          </div>

          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            🇫🇷 Plateforme française
          </span>

          <h1 className="text-[30px] font-extrabold leading-[1.15] sm:text-[34px]" style={{ color: "var(--text-main)" }}>
            Votre gestion documentaire<br />plus simple, plus <span style={{ color: "var(--accent)" }}>sereine.</span>
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Gedify centralise et sécurise tous vos papiers du quotidien : factures, assurances, garanties, impôts, documents de famille et fichiers administratifs de micro-entrepreneur.
          </p>

          {showAuthMessage ? (
            <div className="mt-5 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--text-main)" }} role="status">
              Veuillez vous connecter pour accéder à cette page.
            </div>
          ) : null}

          <div className="mt-6">
            <AuthPanel next={next} signupOpen={signupOpen} oauthEnabled={oauthEnabled} />
          </div>

          <div className="mt-7">
            <TrustBadges />
          </div>
        </div>
      </div>

      {/* ── Partie droite : sombre, hero produit (masquée sur mobile) ── */}
      <div className="relative hidden flex-col justify-center overflow-hidden px-10 py-10 lg:flex xl:px-14" style={{ background: "linear-gradient(160deg,#0B1220 0%,#111c33 55%,#1a1030 100%)" }}>
        {/* halo rose */}
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "var(--accent)" }} aria-hidden="true" />

        <a href="https://gedify.fr" target="_blank" rel="noreferrer" className="absolute right-8 top-8 inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.18)" }}>
          Découvrir la plateforme <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>

        <div className="relative z-10 mx-auto w-full max-w-[620px]">
          <h2 className="text-[34px] font-extrabold leading-[1.12] text-white xl:text-[40px]">
            La GED <span style={{ color: "var(--accent)" }}>intelligente</span><br />pour la maison et l&apos;activité
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
            Capturez, classez, recherchez et partagez vos documents du quotidien, ceux de votre famille et de votre activité indépendante.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {HERO_BADGES.map((b) => (
              <div key={b.title} className="rounded-2xl border p-3" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
                <b.icon className="h-5 w-5" style={{ color: "var(--accent)" }} aria-hidden="true" />
                <div className="mt-2 text-[13px] font-bold text-white">{b.title}</div>
                <div className="text-[11.5px] text-slate-400">{b.sub}</div>
              </div>
            ))}
          </div>

          <HeroProductMockup />
        </div>
      </div>
    </div>
  );
}
