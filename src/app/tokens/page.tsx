import { ExternalLink, EyeOff, KeyRound, ListX } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getPaperlessPublicUrl } from "@/lib/paperless";
import { safePaperlessObject } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

type TokenCapabilities = {
  available?: boolean;
  generationEndpoint?: string;
  note?: string;
};

export default async function TokensPage() {
  const result = await safePaperlessObject<TokenCapabilities>("/api/profile/");
  const paperlessUrl = getPaperlessPublicUrl();

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/administration", label: "Administration" }}
        eyebrow="Administration Gedify"
        title="Tokens API"
        description="Préparation de la gestion des tokens utilisateur Gedify sans exposer le token serveur de Gedify."
        actions={
          paperlessUrl ? (
            <a
              href={`${paperlessUrl}/profile`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Ouvrir le profil Gedify
            </a>
          ) : null
        }
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Token serveur"
          value="Masqué"
          helper="PAPERLESS_TOKEN reste côté serveur"
          icon={EyeOff}
          tone="emerald"
        />
        <StatCard
          label="Génération"
          value="Préparée"
          helper="/api/profile/generate_auth_token/"
          icon={KeyRound}
          tone="blue"
        />
        <StatCard
          label="Liste tokens"
          value="Non exposée"
          helper="Pas d'endpoint de liste identifié"
          icon={ListX}
          tone="slate"
        />
      </section>

      {!result.ok ? (
        <ErrorState title="Profil Gedify indisponible" message={result.error} />
      ) : (
        <div className="rounded-2xl border border-blue-200/60 bg-blue-50/60 p-5 text-sm leading-6 text-blue-900 backdrop-blur">
          Gedify expose un endpoint de génération de token utilisateur, mais Gedify ne
          l&apos;active pas automatiquement pour éviter toute régénération involontaire. Le token
          présent dans <code className="rounded bg-blue-100 px-1 text-xs font-semibold">.env.local</code> n&apos;est jamais affiché ni renvoyé au client.
        </div>
      )}
    </main>
  );
}
