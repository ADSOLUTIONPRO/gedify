import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Database,
  ExternalLink,
  Layers,
  ListTree,
  Mail,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { TechnicalAccordion } from "@/components/ui/technical-accordion";
import { getActiveAIProvider } from "@/lib/ai/ai-provider";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { getMailConnectorStatus } from "@/lib/mail-connector/status";
import { getPaperlessPublicUrl, getPaperlessStatus } from "@/lib/paperless";
import {
  formatPaperlessValue,
  safePaperlessCollection,
  safePaperlessObject,
} from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

type RemoteVersion = {
  version?: string;
  update_available?: boolean;
};

export default async function StatutPage() {
  const [status, tasks, remoteVersion, mailStatus, allAnalyses] = await Promise.all([
    getPaperlessStatus(),
    safePaperlessCollection("/api/tasks/"),
    safePaperlessObject<RemoteVersion>("/api/remote_version/"),
    getMailConnectorStatus(),
    listAnalyses(),
  ]);
  const aiProvider = getActiveAIProvider();
  const aiProviderName = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  const aiKeyPresent = Boolean(process.env.OPENAI_API_KEY);
  const aiModel =
    aiProviderName === "ollama"
      ? (process.env.OLLAMA_MODEL ?? null)
      : process.env.OPENAI_MODEL ?? (aiProvider.isMock ? null : "gpt-4o-mini");
  const lastAnalysis = allAnalyses[0] ?? null;
  const errorAnalyses = allAnalyses.filter((entry) => entry.provider?.includes("fallback-mock"));
  const paperlessUrl = getPaperlessPublicUrl();
  const taskRows = tasks.ok ? tasks.data.results : [];
  const version = remoteVersion.ok ? remoteVersion.data.version : status.version;
  const updateAvailable = remoteVersion.ok
    ? remoteVersion.data.update_available
    : status.updateAvailable;

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/administration", label: "Administration" }}
        eyebrow="Administration Gedify"
        title="Statut système"
        description="État runtime du moteur local : API, base, workers, index, classifieur et tâches récentes."
        actions={
          paperlessUrl ? (
            <a
              href={paperlessUrl}
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

      {!status.connected && status.error ? (
        <div className="mb-6">
          <ErrorState title="Statut du moteur indisponible" message={status.error} />
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Version"
          value={version ?? "—"}
          icon={Sparkles}
          tone="blue"
          helper={updateAvailable ? "Mise à jour disponible" : "À jour ou non vérifié"}
        />
        <StatCard
          label="Base"
          value={status.system?.database?.status ?? "—"}
          helper={status.system?.database?.type ?? "Statut PostgreSQL"}
          icon={Database}
          tone="emerald"
        />
        <StatCard
          label="Workers"
          value={status.system?.tasks?.celery_status ?? "—"}
          helper={`Redis ${status.system?.tasks?.redis_status ?? "non renvoyé"}`}
          icon={Network}
          tone="violet"
        />
        <StatCard
          label="Index"
          value={status.system?.tasks?.index_status ?? "—"}
          helper={`Classifieur ${status.system?.tasks?.classifier_status ?? "non renvoyé"}`}
          icon={Layers}
        />
      </section>

      <SectionCard icon={Activity} title="Composants Gedify">
        <MetadataGrid
          columns={3}
          items={[
            {
              label: "API documents",
              value: (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  Connectée
                </span>
              ),
            },
            { label: "Base de données", value: status.system?.database?.status ?? "—" },
            { label: "Redis", value: status.system?.tasks?.redis_status ?? "—" },
            { label: "Celery", value: status.system?.tasks?.celery_status ?? "—" },
            { label: "Index", value: status.system?.tasks?.index_status ?? "—" },
            { label: "Classifieur", value: status.system?.tasks?.classifier_status ?? "—" },
            { label: "Vérification cohérence", value: status.system?.tasks?.sanity_check_status ?? "—" },
            { label: "Type install", value: status.system?.install_type ?? "—" },
            { label: "OS serveur", value: status.system?.server_os ?? "—" },
          ]}
        />
      </SectionCard>

      <div className="mt-6">
        <SectionCard
          icon={Brain}
          title="Analyse IA"
          description="Provider IA actif et derniers événements."
          actions={
            <Link
              href="/ia"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
            >
              Ouvrir
              <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </Link>
          }
        >
          <MetadataGrid
            columns={3}
            items={[
              {
                label: "Provider actif",
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    {aiProvider.isMock ? (
                      <span className="text-amber-700">Mock (rule-based local)</span>
                    ) : (
                      <span className="text-emerald-700 capitalize">{aiProviderName}</span>
                    )}
                  </span>
                ),
              },
              { label: "Modèle", value: aiModel ?? "—" },
              {
                label: aiProviderName === "ollama" ? "URL Ollama" : "Clé API",
                value: aiProviderName === "ollama" ? (
                  process.env.OLLAMA_BASE_URL ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      Configurée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      Absente
                    </span>
                  )
                ) : aiKeyPresent ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    Présente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    Absente
                  </span>
                ),
              },
              {
                label: "État",
                value: aiProvider.isMock
                  ? "Mock actif"
                  : aiProviderName === "ollama"
                    ? (process.env.OLLAMA_BASE_URL ? "Prêt" : "Non configuré")
                    : aiKeyPresent
                      ? "Prêt"
                      : "Non configuré",
              },
              {
                label: "Analyses totales",
                value: allAnalyses.length,
              },
              {
                label: "Dernière analyse",
                value: lastAnalysis
                  ? new Date(lastAnalysis.updatedAt).toLocaleString("fr-FR")
                  : "Aucune",
              },
              {
                label: "Fallback déclenchés",
                value:
                  errorAnalyses.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      {errorAnalyses.length}
                      <span className="text-[10px] font-normal text-slate-500">
                        ({aiProviderName} → mock)
                      </span>
                    </span>
                  ) : (
                    "0"
                  ),
              },
              { label: "Strategy", value: "Validation utilisateur requise" },
              {
                label: "Variable",
                value: <code className="font-mono text-[11px]">AI_PROVIDER={aiProviderName}</code>,
              },
            ].filter((item) => item.label !== "Fallback déclenchés" || errorAnalyses.length > 0)}
          />
          <p className="mt-3 text-[11px] text-slate-500">
            Les secrets (clés, URLs) ne sont jamais exposés au navigateur. L&apos;analyse transmet le
            contenu OCR au provider configuré ({aiProviderName}).
          </p>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          icon={Mail}
          title="Connecteurs email"
          description="Module de synchronisation IMAP géré par la surcouche."
          actions={
            <Link
              href="/messagerie/parametres-emails"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
            >
              Ouvrir
              <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </Link>
          }
        >
          <MetadataGrid
            columns={3}
            items={[
              { label: "Comptes configurés", value: mailStatus.configured },
              { label: "Comptes actifs", value: mailStatus.active },
              {
                label: "Dernière synchronisation",
                value: mailStatus.lastSyncAt
                  ? new Date(mailStatus.lastSyncAt).toLocaleString("fr-FR")
                  : "Aucune",
              },
              {
                label: "Dernier succès",
                value: mailStatus.lastSuccessAt
                  ? new Date(mailStatus.lastSuccessAt).toLocaleString("fr-FR")
                  : "Aucun",
              },
              {
                label: "Erreurs (24h)",
                value: (
                  <span
                    className={
                      mailStatus.recentErrors > 0
                        ? "inline-flex items-center gap-1 text-rose-700"
                        : "inline-flex items-center gap-1 text-emerald-700"
                    }
                  >
                    {mailStatus.recentErrors > 0 ? (
                      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    )}
                    {mailStatus.recentErrors}
                  </span>
                ),
              },
              { label: "Stockage", value: mailStatus.storageDriver },
              {
                label: "Mot de passe chiffré",
                value: mailStatus.secureStorageReady ? "Prêt" : "À connecter",
              },
              {
                label: "OAuth Gmail",
                value: mailStatus.oauthGmailReady ? "Prêt" : "À connecter",
              },
              {
                label: "OAuth Outlook",
                value: mailStatus.oauthOutlookReady ? "Prêt" : "À connecter",
              },
              {
                label: "Worker / cron",
                value: mailStatus.workerReady ? "Secret configuré" : "À connecter",
              },
            ]}
          />
          {!mailStatus.secureStorageReady ||
          !mailStatus.workerReady ||
          !mailStatus.oauthGmailReady ||
          !mailStatus.oauthOutlookReady ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span>
                Variables d&apos;environnement à définir pour activer toutes les fonctionnalités :{" "}
                <code className="rounded bg-amber-100 px-1 font-mono">MAIL_CONNECTOR_KEY</code>,{" "}
                <code className="rounded bg-amber-100 px-1 font-mono">MAIL_CONNECTOR_SYNC_SECRET</code>,
                <code className="ml-1 rounded bg-amber-100 px-1 font-mono">GOOGLE_OAUTH_*</code>,{" "}
                <code className="rounded bg-amber-100 px-1 font-mono">MICROSOFT_OAUTH_*</code>.
              </span>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard icon={ListTree} title="Tâches récentes">
          {!tasks.ok ? (
            <ErrorState title="Tâches indisponibles" message={tasks.error} />
          ) : taskRows.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune tâche récente renvoyée par Gedify.</p>
          ) : (
            <div className="space-y-2.5">
              {taskRows.slice(0, 8).map((task, index) => {
                const taskStatus =
                  typeof task.status === "string" ? task.status : "Tâche";
                const taskName =
                  typeof task.task_name === "string"
                    ? task.task_name
                    : typeof task.type === "string"
                      ? task.type
                      : `Tâche #${task.id ?? index}`;
                const taskWhen =
                  typeof task.date_created === "string"
                    ? task.date_created
                    : typeof task.date_done === "string"
                      ? task.date_done
                      : null;
                return (
                  <div
                    key={typeof task.id === "string" || typeof task.id === "number" ? task.id : index}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{taskName}</p>
                      {taskWhen ? (
                        <p className="text-xs text-slate-500">{taskWhen}</p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        taskStatus.toLowerCase().includes("success") ||
                        taskStatus.toLowerCase().includes("completed")
                          ? "bg-emerald-50 text-emerald-700"
                          : taskStatus.toLowerCase().includes("failure")
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {taskStatus}
                    </span>
                  </div>
                );
              })}
              {taskRows.length > 8 ? (
                <TechnicalAccordion
                  title={`Voir les ${taskRows.length - 8} autres tâches`}
                  description="Données brutes telles que renvoyées par /api/tasks/"
                >
                  <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                    {formatPaperlessValue(taskRows.slice(8))}
                  </pre>
                </TechnicalAccordion>
              ) : null}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
