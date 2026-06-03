import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Connexion — Gedify" };

type SearchParams = Promise<{ next?: string; reason?: string }>;

/** N'autorise que les chemins internes (évite les open-redirects via ?next=). */
function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, reason } = await searchParams;

  // Déjà connecté : pas de formulaire, on renvoie vers l'espace demandé (ou /).
  const session = await readSession();
  if (session) {
    redirect(safeNext(next));
  }

  const showAuthMessage = reason === "auth_required";

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: "var(--bg-page)" }}
    >
      <div className="w-full max-w-[420px]">

        {/* Logo + identité */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo variant="full" className="h-14 w-auto" />
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Espace documentaire sécurisé
          </p>
        </div>

        {/* Message "connexion requise" */}
        {showAuthMessage && (
          <div
            className="mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5"
            style={{ borderColor: "#BFDBFE", background: "#EFF6FF" }}
          >
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--blue-600)" }} strokeWidth={1.75} />
            <p className="text-[13px] font-medium leading-snug" style={{ color: "#1E40AF" }}>
              Vous devez vous connecter pour accéder à votre espace GED.
            </p>
          </div>
        )}

        {/* Carte connexion */}
        <div
          className="rounded-2xl border bg-white p-8 shadow-lg"
          style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="mb-6">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5" style={{ color: "var(--blue-600)" }} strokeWidth={1.75} aria-hidden="true" />
              <h2 className="text-[18px] font-extrabold" style={{ color: "var(--text-main)" }}>
                Connexion à votre espace GED
              </h2>
            </div>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Connectez-vous avec vos identifiants.
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        {/* Pied de page */}
        <p className="mt-5 text-center text-[11.5px]" style={{ color: "var(--text-hint)" }}>
          Accès réservé — espace documentaire privé
        </p>
      </div>
    </div>
  );
}
