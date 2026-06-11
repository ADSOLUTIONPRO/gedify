import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Globe,
  HardDrive,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getCurrentRole } from "@/lib/auth/current-user";
import { getEnvironmentDiagnostics, isPostgresUrl, type AppEnv } from "@/lib/config/environment";
import { getStorageMode } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

export const dynamic = "force-dynamic";

const STORAGE_MODE_LABEL: Record<"postgres" | "sqlite" | "json", string> = {
  postgres: "PostgreSQL",
  sqlite: "SQLite",
  json: "JSON (fichiers)",
};

const ENV_LABEL: Record<AppEnv, string> = {
  development: "Développement",
  staging: "Staging",
  production: "Production",
};

const ENV_TONE: Record<AppEnv, { bg: string; color: string }> = {
  development: { bg: "#E0F2FE", color: "#0369A1" },
  staging: { bg: "#FFEDD5", color: "#C2410C" },
  production: { bg: "#DCFCE7", color: "#15803D" },
};

function EnvPill({ env }: { env: AppEnv }) {
  const t = ENV_TONE[env];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide"
      style={{ background: t.bg, color: t.color }}
    >
      {ENV_LABEL[env]}
    </span>
  );
}

/** Booléen « configuré / activé » → Oui (vert) / Non (gris ou rouge selon le poids). */
function YesNo({ value, danger = false }: { value: boolean; danger?: boolean }) {
  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        Oui
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${danger ? "text-rose-700" : "text-slate-500"}`}
    >
      {danger ? (
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      ) : (
        <XCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      )}
      Non
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px]">{children}</code>;
}

export default async function EnvironmentDiagnosticPage() {
  // Garde admin : roleOf(null) === "admin" → ne verrouille jamais le compte
  // unique ni le mode bureau local (GEDIFY_LOCAL_NO_AUTH).
  const role = await getCurrentRole();
  if (role !== "admin") {
    return (
      <PageShell>
        <PageHeader
          breadcrumb={[
            { href: "/dashboard", label: "Accueil" },
            { href: "/administration", label: "Administration" },
            { label: "Environnement" },
          ]}
          title="Diagnostic environnement"
          description="Accès réservé aux administrateurs."
        />
        <SectionCard icon={ShieldCheck} title="Accès refusé">
          <p className="text-sm text-slate-600">
            Cette page de diagnostic est réservée aux administrateurs.
          </p>
        </SectionCard>
      </PageShell>
    );
  }

  const d = getEnvironmentDiagnostics();
  const storageMode = getStorageMode();
  const dataDir = getDataDir();
  const databaseType = isPostgresUrl(process.env.DATABASE_URL)
    ? "PostgreSQL"
    : d.databaseUrlConfigured
      ? "Autre"
      : "—";

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/administration", label: "Administration" },
          { label: "Environnement" },
        ]}
        title="Diagnostic environnement"
        description="État de configuration de l'instance (déploiement Coolify SaaS / Synology). Aucun secret n'est affiché."
      />

      <SectionCard
        icon={Server}
        title="Application"
        description="Environnement actif et URLs publiques."
      >
        <MetadataGrid
          columns={3}
          items={[
            { label: "APP_ENV", value: <EnvPill env={d.appEnv} /> },
            { label: "NEXT_PUBLIC_APP_ENV", value: <EnvPill env={d.publicAppEnv} /> },
            { label: "APP_URL configuré", value: <YesNo value={d.appUrlConfigured} /> },
            {
              label: "NEXT_PUBLIC_APP_URL",
              value: d.publicAppUrl ? <Mono>{d.publicAppUrl}</Mono> : "",
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        icon={Database}
        title="Données & cache"
        description="Présence des connexions sensibles — la valeur n'est jamais exposée."
      >
        <MetadataGrid
          columns={3}
          items={[
            { label: "DATABASE_URL configurée", value: <YesNo value={d.databaseUrlConfigured} /> },
            { label: "REDIS_URL configurée", value: <YesNo value={d.redisUrlConfigured} /> },
          ]}
        />
      </SectionCard>

      <SectionCard
        icon={Database}
        title="Stockage métier (base de données)"
        description="Moteur effectif des données métier — distinct du stockage des fichiers."
      >
        <MetadataGrid
          columns={3}
          items={[
            {
              label: "Storage mode actuel",
              value:
                storageMode === "postgres" ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    {STORAGE_MODE_LABEL[storageMode]}
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      d.appEnv === "staging" || d.appEnv === "production"
                        ? "text-rose-700"
                        : "text-slate-700"
                    }`}
                  >
                    {d.appEnv === "staging" || d.appEnv === "production" ? (
                      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    ) : null}
                    {STORAGE_MODE_LABEL[storageMode]}
                  </span>
                ),
            },
            { label: "Database configured", value: <YesNo value={d.databaseUrlConfigured} /> },
            { label: "Database type detected", value: <Mono>{databaseType}</Mono> },
            { label: "dataDir", value: <Mono>{dataDir}</Mono> },
            { label: "APP_ENV", value: <EnvPill env={d.appEnv} /> },
            { label: "STORAGE_DRIVER", value: <Mono>{d.storageDriver}</Mono> },
            { label: "STORAGE_ROOT", value: <Mono>{d.storageRoot}</Mono> },
          ]}
        />
        {(d.appEnv === "staging" || d.appEnv === "production") && storageMode === "json" ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-xs text-rose-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>
              Environnement SaaS en stockage JSON : les données métier ne sont pas persistées en
              base. Configurez une <Mono>DATABASE_URL</Mono> PostgreSQL (le mode bascule
              automatiquement). Le démarrage est refusé sauf{" "}
              <Mono>ALLOW_JSON_STORAGE_IN_SAAS=true</Mono>.
            </span>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        icon={HardDrive}
        title="Stockage des fichiers"
        description="Pilote, racine et préfixe de clés (distinct du mode base de données)."
      >
        <MetadataGrid
          columns={3}
          items={[
            { label: "STORAGE_DRIVER", value: <Mono>{d.storageDriver}</Mono> },
            { label: "STORAGE_ROOT", value: <Mono>{d.storageRoot}</Mono> },
            {
              label: "STORAGE_PREFIX",
              value: d.storagePrefix ? <Mono>{d.storagePrefix}</Mono> : "(aucun)",
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        icon={Cloud}
        title="Services"
        description="Fournisseurs externes — modes lisibles uniquement, sans clé ni secret."
      >
        <MetadataGrid
          columns={3}
          items={[
            { label: "AI_PROVIDER", value: <Mono>{d.aiProvider}</Mono> },
            { label: "EMAILS_ENABLED", value: <YesNo value={d.emailsEnabled} /> },
            { label: "ENCRYPTION_MASTER_KEY", value: <YesNo value={d.encryptionConfigured} /> },
            { label: "STRIPE_MODE", value: <Mono>{d.stripeMode}</Mono> },
          ]}
        />
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>
            Les secrets (DATABASE_URL complète, clés API, tokens, AUTH_SECRET, STRIPE_SECRET_KEY…)
            ne sont jamais exposés — seules les présences et les valeurs non sensibles sont
            affichées. Rapport généré le{" "}
            {new Date(d.generatedAt).toLocaleString("fr-FR")}.
          </span>
        </div>
      </SectionCard>
    </PageShell>
  );
}
