import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileBox,
  Filter,
  Inbox,
  Paperclip,
  Server,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AccountActions } from "@/components/mail-connector/account-actions";
import { GmailControls } from "@/components/mail-connector/gmail-controls";
import { GmailFolderPrefs } from "@/components/mail-connector/gmail-folder-prefs";
import { ErrorState } from "@/components/ui/error-state";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { getAccount } from "@/lib/mail-connector/account-store";
import { DEFAULT_EXCLUDED_FOLDER_NAMES } from "@/lib/mail-connector/default-excluded-folders";
import { isSecureStorageReady } from "@/lib/mail-connector/encryption";
import { listLogs } from "@/lib/mail-connector/log-store";
import { findProvider } from "@/lib/mail-connector/providers";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountDetailPage({ params }: PageProps) {
  const { id } = await params;
  const account = await getAccount(id);

  if (!account) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          backLink={{ href: "/emails/comptes", label: "Comptes email" }}
          eyebrow="Connecteurs mail"
          title="Compte introuvable"
        />
        <ErrorState
          title="Compte introuvable"
          message="Aucun compte mail avec cet identifiant n'a été trouvé."
        />
      </main>
    );
  }

  const provider = findProvider(account.provider);
  const logs = await listLogs({ accountId: id, limit: 20 });
  const secureReady = isSecureStorageReady();

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/emails/comptes", label: "Comptes email" }}
        eyebrow="Compte mail"
        title={account.name}
        description={`${provider?.name ?? account.provider} · ${account.email}`}
      />

      {account.connector === "gmail-oauth" ? (
        <div className="mb-6">
          <GmailControls accountId={account.id} email={account.gmailEmail ?? account.email} />
        </div>
      ) : (
        <div className="mb-6">
          <AccountActions accountId={account.id} hasPassword={account.hasPassword} />
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Statut"
          value={account.isActive ? "Actif" : "Désactivé"}
          icon={account.isActive ? CheckCircle2 : AlertTriangle}
          tone={account.isActive ? "emerald" : "slate"}
          helper={
            account.hasPassword ? "Mot de passe chiffré" : secureReady ? "Sans mot de passe" : "Stockage à connecter"
          }
        />
        <StatCard
          label="Dernière synchro"
          value={
            account.lastSyncAt ? new Date(account.lastSyncAt).toLocaleString("fr-FR") : "Aucune"
          }
          icon={Inbox}
          tone="blue"
        />
        <StatCard
          label="Dernier succès"
          value={
            account.lastSuccessAt
              ? new Date(account.lastSuccessAt).toLocaleString("fr-FR")
              : "Aucun"
          }
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Logs récents"
          value={logs.length}
          helper={`${logs.filter((log) => log.status === "imported").length} imports réussis`}
          icon={FileBox}
          tone="violet"
        />
      </section>

      {account.lastError ? (
        <div className="mb-6">
          <ErrorState title="Dernière erreur de synchronisation" message={account.lastError} />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard icon={Server} title="Connexion IMAP">
          <MetadataGrid
            items={[
              { label: "Hôte", value: `${account.imapHost}:${account.imapPort}` },
              { label: "Chiffrement", value: account.encryption.toUpperCase() },
              { label: "Identifiant", value: account.username },
              { label: "Dossier surveillé", value: account.watchedFolder },
              { label: "Méthode", value: methodLabel(account.authType) },
              { label: "Mot de passe", value: account.hasPassword ? "Chiffré (AES-256-GCM)" : "Non stocké" },
            ]}
          />
        </SectionCard>

        <SectionCard icon={Settings2} title="Comportement de synchronisation">
          <MetadataGrid
            items={[
              { label: "Intervalle", value: `${account.syncIntervalMinutes} min` },
              {
                label: "Filtre pièces jointes",
                value: account.attachmentFilter === "pdf-only" ? "PDF uniquement" : "Toutes compatibles",
              },
              { label: "Ignorer déjà lus", value: account.ignoreAlreadyRead ? "Oui" : "Non" },
              { label: "Marquer comme lu", value: account.markAsRead ? "Oui" : "Non" },
              { label: "Supprimer après import", value: account.deleteAfterImport ? "Oui" : "Non" },
              {
                label: "Tags par défaut",
                value: account.defaultTags.length ? account.defaultTags.join(", ") : "Aucun",
              },
            ]}
          />
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard icon={Filter} title="Dossiers et labels">
          {account.connector === "gmail-oauth" ? (
            <GmailFolderPrefs accountId={account.id} />
          ) : (
          <>
          <p className="mb-3 text-xs text-slate-500">
            Sélectionnez les dossiers IMAP à surveiller. Les dossiers Spam, Corbeille, Brouillons et Envoyés sont exclus par défaut (FR + EN).
          </p>
          {account.folderRules?.watchedFolders.length ? (
            <div className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Surveillés
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {account.folderRules.watchedFolders.map((folder) => (
                  <span
                    key={folder}
                    className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700"
                  >
                    {folder}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Exclus par défaut
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {DEFAULT_EXCLUDED_FOLDER_NAMES.slice(0, 14).map((folder) => (
              <span
                key={folder}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
              >
                {folder}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Modifiez ces listes via{" "}
            <code className="rounded bg-slate-100 px-1 font-mono">
              PATCH /api/mail-connector/accounts/{account.id}/filters
            </code>{" "}
            avec <code className="font-mono">folderRules</code>.
          </p>
          </>
          )}
        </SectionCard>

        <SectionCard icon={Users} title="Expéditeurs">
          <p className="mb-3 text-xs text-slate-500">
            Vous pouvez limiter l&apos;import aux organismes importants : CAF, CPAM, impôts, banque, assurance, notaire…
          </p>
          <MetadataGrid
            items={[
              {
                label: "Mode",
                value: account.senderFilter?.mode ?? "allow-all-except-blocked",
              },
              {
                label: "Domaines autorisés",
                value: account.senderFilter?.allowedDomains.length
                  ? account.senderFilter.allowedDomains.join(", ")
                  : "—",
              },
              {
                label: "Domaines bloqués",
                value: account.senderFilter?.blockedDomains.length
                  ? account.senderFilter.blockedDomains.join(", ")
                  : "—",
              },
              {
                label: "Expéditeurs autorisés",
                value: account.senderFilter?.allowedSenders.length
                  ? account.senderFilter.allowedSenders.join(", ")
                  : "—",
              },
            ]}
          />
        </SectionCard>

        <SectionCard icon={Paperclip} title="Pièces jointes">
          <p className="mb-3 text-xs text-slate-500">
            GED AzServer ignore automatiquement logos, signatures email, images de tracking et
            extensions dangereuses.
          </p>
          <MetadataGrid
            items={[
              {
                label: "Mode",
                value: account.attachmentRules?.mode ?? account.attachmentFilter,
              },
              {
                label: "Inline ignorés",
                value: account.attachmentRules?.skipInline === false ? "Non" : "Oui",
              },
              {
                label: "Taille min.",
                value:
                  account.attachmentRules?.minSizeBytes !== undefined
                    ? `${Math.round(account.attachmentRules.minSizeBytes / 1024)} ko`
                    : "5 ko",
              },
              {
                label: "Taille max.",
                value:
                  account.attachmentRules?.maxSizeBytes !== undefined
                    ? `${Math.round(account.attachmentRules.maxSizeBytes / 1_000_000)} Mo`
                    : "30 Mo",
              },
            ]}
          />
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          icon={FileBox}
          title="Derniers événements"
          description="20 derniers logs pour ce compte. Les pièces jointes importées sont liées au document Gedify créé."
        >
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun log pour ce compte.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {logs.map((log) => (
                <li key={log.id} className="grid gap-1 py-3 sm:grid-cols-[140px_1fr_auto] sm:items-center">
                  <span className="text-xs font-semibold text-slate-500">
                    {new Date(log.createdAt).toLocaleString("fr-FR")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {log.attachmentName ?? log.subject ?? "—"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {log.from ?? "—"}
                      {log.subject && log.attachmentName ? ` · ${log.subject}` : ""}
                    </p>
                    {log.errorMessage ? (
                      <p className="mt-0.5 truncate text-xs text-rose-700">{log.errorMessage}</p>
                    ) : null}
                  </div>
                  <LogStatusBadge status={log.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {provider?.notes && provider.notes.length > 0 ? (
        <div className="mt-6">
          <SectionCard icon={ShieldCheck} title={`Notes ${provider.name}`}>
            <ul className="space-y-2 text-sm leading-6 text-slate-600">
              {provider.notes.map((note) => (
                <li key={note} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  {note}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      ) : null}

      {provider && account.email ? (
        <p className="mt-4 inline-flex items-center gap-1 text-xs text-slate-500">
          <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Connecteur géré par Gedify — distinct de l&apos;import mail natif Gedify.
        </p>
      ) : null}
    </main>
  );
}

function methodLabel(authType: string): string {
  if (authType === "oauth-gmail") return "OAuth Google (à connecter)";
  if (authType === "oauth-outlook") return "OAuth Microsoft (à connecter)";
  return "IMAP + mot de passe";
}

function LogStatusBadge({ status }: { status: string }) {
  const palette =
    status === "imported"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "error"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : status === "duplicate"
          ? "bg-violet-50 text-violet-700 border-violet-200"
          : status === "pending"
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${palette}`}
    >
      {status}
    </span>
  );
}
