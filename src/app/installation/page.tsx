import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert, UserPlus } from "lucide-react";
import { SetupForm } from "./setup-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { hasAnyUser } from "@/lib/engine/users";

export const metadata: Metadata = { title: "Première connexion — Gedify" };

export default async function InstallationPage() {
  // App déjà initialisée : aucun compte à créer → on renvoie vers la connexion.
  if (await hasAnyUser()) {
    redirect("/login");
  }

  const authConfigured = Boolean(process.env.AUTH_SECRET?.trim());

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
            Première connexion — création du compte administrateur
          </p>
        </div>

        {/* Carte installation */}
        <div
          className="rounded-2xl border bg-white p-8 shadow-lg"
          style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="mb-6">
            <div className="flex items-center gap-2.5">
              <UserPlus className="h-5 w-5" style={{ color: "var(--blue-600)" }} strokeWidth={1.75} aria-hidden="true" />
              <h2 className="text-[18px] font-extrabold" style={{ color: "var(--text-main)" }}>
                Créer le compte administrateur
              </h2>
            </div>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Ce compte est enregistré durablement. Vous l&apos;utiliserez ensuite sur la page de connexion.
            </p>
          </div>

          {!authConfigured && (
            <div
              className="mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]"
              style={{ borderColor: "#FDE68A", background: "#FEF3C7", color: "#92400E" }}
              role="alert"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>
                <strong>AUTH_SECRET</strong> n&apos;est pas configuré : impossible de créer le compte.
                Ajoutez la variable d&apos;environnement puis rechargez la page.
              </span>
            </div>
          )}

          <SetupForm disabled={!authConfigured} />
        </div>

        <p className="mt-5 text-center text-[11.5px]" style={{ color: "var(--text-hint)" }}>
          Cet écran n&apos;apparaît qu&apos;une seule fois, à l&apos;installation.
        </p>
      </div>
    </div>
  );
}
