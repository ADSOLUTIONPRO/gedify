import {
  Bell,
  Database,
  Eye,
  HardDrive,
  KeyRound,
  Link2,
  Moon,
  Palette,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  UserCircle,
} from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { getPaperlessPublicUrl, getPaperlessStatus } from "@/lib/paperless";
import {
  formatPaperlessValue,
  safePaperlessCollection,
  safePaperlessObject,
} from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

type UiSettings = {
  settings?: Record<string, unknown>;
  permissions?: unknown[];
};

type RemoteVersion = {
  version?: string;
  update_available?: boolean;
};

export default async function ParametresPage() {
  const [status, uiSettings, config, remoteVersion] = await Promise.all([
    getPaperlessStatus(),
    safePaperlessObject<UiSettings>("/api/ui_settings/"),
    safePaperlessCollection("/api/config/"),
    safePaperlessObject<RemoteVersion>("/api/remote_version/"),
  ]);
  const paperlessUrl = getPaperlessPublicUrl();
  const userName = [status.user?.first_name, status.user?.last_name].filter(Boolean).join(" ");
  const displayedUser = userName || status.user?.email || "Non renvoyé";
  const storageTotal = status.system?.storage?.total ?? 0;
  const storageAvailable = status.system?.storage?.available ?? 0;
  const storageUsedPercent =
    storageTotal > 0
      ? Math.round(((storageTotal - storageAvailable) / storageTotal) * 100)
      : null;
  const settings = uiSettings.ok ? uiSettings.data.settings ?? {} : {};
  const configEntry = config.ok ? config.data.results[0] : null;
  const safeConfigFields = configEntry
    ? Object.entries(configEntry)
        .filter(([key]) => !/password|token|secret|key|url/i.test(key))
        .slice(0, 8)
    : [];

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/administration", label: "Administration" }}
        eyebrow="Administration Gedify"
        title="Paramètres"
        description="État de connexion Gedify, informations d'environnement et préférences d'interface."
      />

      {!status.connected && status.error ? (
        <div className="mb-6">
          <ErrorState title="Connexion au moteur indisponible" message={status.error} />
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="API du moteur"
          value={status.connected ? "Connectée" : "Erreur"}
          helper={paperlessUrl ?? "PAPERLESS_URL non configurée"}
          icon={Link2}
          tone={status.connected ? "emerald" : "amber"}
        />
        <StatCard
          label="Version Gedify"
          value={status.version ?? "—"}
          helper={
            status.updateAvailable === true
              ? "Mise à jour disponible"
              : "Version renvoyée par l'API"
          }
          icon={Sparkles}
          tone="blue"
        />
        <StatCard
          label="Version API"
          value={status.apiVersion ?? "—"}
          helper="Header X-Api-Version"
          icon={TerminalSquare}
          tone="violet"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard icon={UserCircle} title="Utilisateur courant">
          <MetadataGrid
            items={[
              { label: "Compte Gedify", value: displayedUser },
              {
                label: "Authentification",
                value: status.user?.is_mfa_enabled
                  ? "MFA activé"
                  : "MFA non activé ou non renvoyé",
              },
            ]}
          />
        </SectionCard>

        <SectionCard icon={Palette} title="Paramètres UI Gedify">
          {!uiSettings.ok ? (
            <ErrorState title="Paramètres UI indisponibles" message={uiSettings.error} />
          ) : (
            <MetadataGrid
              items={[
                { label: "Titre application", value: formatPaperlessValue(settings.app_title) },
                { label: "Email activé", value: formatPaperlessValue(settings.email_enabled) },
                { label: "Délai corbeille", value: formatPaperlessValue(settings.trash_delay) },
                {
                  label: "Permissions",
                  value: Array.isArray(uiSettings.data.permissions)
                    ? `${uiSettings.data.permissions.length} permission(s)`
                    : "Non renvoyé",
                },
              ]}
            />
          )}
        </SectionCard>

        <SectionCard icon={TerminalSquare} title="Configuration Gedify">
          {!config.ok ? (
            <ErrorState title="Configuration indisponible" message={config.error} />
          ) : safeConfigFields.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune configuration non sensible à afficher.
            </p>
          ) : (
            <MetadataGrid
              items={safeConfigFields.map(([key, value]) => ({
                label: key,
                value: formatPaperlessValue(value),
              }))}
            />
          )}
        </SectionCard>

        <SectionCard icon={Sparkles} title="Version distante">
          {!remoteVersion.ok ? (
            <ErrorState title="Version distante indisponible" message={remoteVersion.error} />
          ) : (
            <MetadataGrid
              items={[
                { label: "Version", value: remoteVersion.data.version ?? "Non renvoyée" },
                {
                  label: "Mise à jour",
                  value: remoteVersion.data.update_available ? "Disponible" : "Aucune signalée",
                },
              ]}
            />
          )}
        </SectionCard>

        <SectionCard icon={Database} title="État système Gedify">
          <MetadataGrid
            items={[
              {
                label: "Base de données",
                icon: <Database className="h-3 w-3" strokeWidth={2} />,
                value: status.system?.database?.status ?? "Non renvoyé",
              },
              {
                label: "Index",
                value: status.system?.tasks?.index_status ?? "Non renvoyé",
              },
              {
                label: "Classifieur",
                value: status.system?.tasks?.classifier_status ?? "Non renvoyé",
              },
              {
                label: "Stockage",
                icon: <HardDrive className="h-3 w-3" strokeWidth={2} />,
                value:
                  storageUsedPercent === null ? "Non renvoyé" : `${storageUsedPercent}% utilisé`,
              },
            ]}
          />
        </SectionCard>

        <SectionCard icon={ShieldCheck} title="Sécurité">
          <ul className="space-y-2.5 text-sm leading-6 text-slate-600">
            <li className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                strokeWidth={2}
                aria-hidden="true"
              />
              Le jeton du moteur est lu uniquement côté serveur.
            </li>
            <li className="flex items-start gap-2">
              <KeyRound
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                strokeWidth={2}
                aria-hidden="true"
              />
              Les composants client utilisent les routes internes <code className="rounded bg-slate-100 px-1 text-xs font-semibold">/api/paperless/*</code>.
            </li>
            <li className="flex items-start gap-2">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                strokeWidth={2}
                aria-hidden="true"
              />
              Gedify reste la source de vérité.
            </li>
          </ul>
        </SectionCard>

        <SectionCard icon={Eye} title="Préférences d'affichage">
          <div className="space-y-2.5">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/60 bg-white/60 p-4">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Vue documents</span>
                  <span className="block text-xs text-slate-500">Tableau par défaut</span>
                </span>
              </span>
              <input
                type="checkbox"
                checked
                readOnly
                className="h-5 w-5 rounded border-slate-300 text-blue-600"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/60 bg-white/60 p-4">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Thème sombre</span>
                  <span className="block text-xs text-slate-500">Prévu pour une prochaine étape</span>
                </span>
              </span>
              <input
                type="checkbox"
                disabled
                className="h-5 w-5 rounded border-slate-300"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/60 bg-white/60 p-4">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Notifications</span>
                  <span className="block text-xs text-slate-500">À venir</span>
                </span>
              </span>
              <input
                type="checkbox"
                disabled
                className="h-5 w-5 rounded border-slate-300"
              />
            </label>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
