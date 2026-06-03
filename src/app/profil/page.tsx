import { ExternalLink, KeyRound, Mail, ShieldCheck, UserCircle } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getPaperlessPublicUrl } from "@/lib/paperless";
import { formatPaperlessValue } from "@/lib/paperless-resources";
import { safePaperlessObject } from "@/lib/paperless-resources";
import type { PaperlessProfile } from "@/lib/paperless-types";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const result = await safePaperlessObject<PaperlessProfile>("/api/profile/");
  const paperlessUrl = getPaperlessPublicUrl();
  const profile = result.ok ? result.data : null;
  const userName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/administration", label: "Administration" }}
        eyebrow="Administration Gedify"
        title="Profil"
        description="Profil utilisateur Gedify courant. Les valeurs sensibles renvoyées par Gedify ne sont pas affichées."
        actions={
          paperlessUrl ? (
            <a
              href={`${paperlessUrl}/profile`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Ouvrir le document
            </a>
          ) : null
        }
      />

      {!result.ok ? (
        <ErrorState title="Profil indisponible" message={result.error} />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Utilisateur"
            value={userName || "Non renseigné"}
            helper="Nom public"
            icon={UserCircle}
            tone="blue"
          />
          <StatCard
            label="Email"
            value={profile?.email ?? "Non renseigné"}
            helper="Compte Gedify"
            icon={Mail}
            tone="violet"
          />
          <StatCard
            label="Mot de passe"
            value={formatPaperlessValue(profile?.has_usable_password)}
            helper="Compte utilisable localement"
            icon={KeyRound}
            tone="amber"
          />
          <StatCard
            label="MFA"
            value={profile?.is_mfa_enabled ? "Activé" : "Non activé"}
            helper="Sécurité du compte"
            icon={ShieldCheck}
            tone="emerald"
          />
        </section>
      )}
    </main>
  );
}
