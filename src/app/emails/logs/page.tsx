import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileBox,
  Filter,
  Pause,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { listLogs } from "@/lib/mail-connector/log-store";
import type { MailSyncLogStatus } from "@/lib/mail-connector/types";
import { firstParam, type PageSearchParams } from "@/lib/page-params";
import { getPaperlessPublicUrl } from "@/lib/paperless";

export const dynamic = "force-dynamic";

const STATUS_FILTER_VALUES: MailSyncLogStatus[] = [
  "imported",
  "ignored",
  "error",
  "duplicate",
  "pending",
];

function maskAddress(address: string | null): string {
  if (!address) return "—";
  // Hide everything between < > and only show user@domain
  const match = address.match(/<([^>]+)>/);
  const email = match ? match[1] : address;
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const visible = user.length <= 3 ? user : `${user.slice(0, 3)}…`;
  return `${visible}@${domain}`;
}

function statusTone(status: MailSyncLogStatus): string {
  switch (status) {
    case "imported":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "duplicate":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "pending":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function statusIcon(status: MailSyncLogStatus) {
  switch (status) {
    case "imported":
      return <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />;
    case "error":
      return <XCircle className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />;
    case "duplicate":
      return <Copy className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />;
    case "pending":
      return <Pause className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />;
    default:
      return <AlertTriangle className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />;
  }
}

export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const accountFilter = firstParam(params, "account");
  const statusRaw = firstParam(params, "status");
  const statusFilter = STATUS_FILTER_VALUES.includes(statusRaw as MailSyncLogStatus)
    ? (statusRaw as MailSyncLogStatus)
    : undefined;

  const [accounts, logs] = await Promise.all([
    listAccounts(),
    listLogs({
      accountId: accountFilter || undefined,
      status: statusFilter,
      limit: 200,
    }),
  ]);
  const paperlessUrl = getPaperlessPublicUrl();

  const stats = {
    imported: logs.filter((log) => log.status === "imported").length,
    errors: logs.filter((log) => log.status === "error").length,
    ignored: logs.filter((log) => log.status === "ignored").length,
    duplicates: logs.filter((log) => log.status === "duplicate").length,
  };

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/emails", label: "Emails" }}
        eyebrow="Connecteurs mail"
        title="Logs de synchronisation"
        description="Historique des messages traités par le connecteur mail. Les adresses sont masquées."
        actions={
          paperlessUrl ? (
            <a
              href={`${paperlessUrl}/processed_mail`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Logs natifs Gedify
            </a>
          ) : null
        }
      />

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Imports" value={stats.imported} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Erreurs" value={stats.errors} icon={XCircle} tone="amber" />
        <StatCard label="Ignorés" value={stats.ignored} icon={Pause} tone="slate" />
        <StatCard label="Doublons" value={stats.duplicates} icon={Copy} tone="violet" />
      </section>

      <SectionCard
        icon={Filter}
        title="Filtres"
        bodyClassName="p-4"
        className="mb-6"
      >
        <form action="/emails/logs" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Compte
            </span>
            <select
              name="account"
              defaultValue={accountFilter}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Tous les comptes</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Statut
            </span>
            <select
              name="status"
              defaultValue={statusRaw}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Tous</option>
              <option value="imported">Importés</option>
              <option value="error">Erreurs</option>
              <option value="ignored">Ignorés</option>
              <option value="duplicate">Doublons</option>
              <option value="pending">En attente</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-11 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600"
            >
              Filtrer
            </button>
            <a
              href="/emails/logs"
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Effacer
            </a>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        icon={FileBox}
        title={`Événements (${logs.length})`}
        description="Les 200 derniers logs sont conservés. Les adresses sont partiellement masquées."
        bodyClassName=""
      >
        {logs.length === 0 ? (
          <EmptyState
            icon={FileBox}
            title="Aucun log pour le moment"
            description="Les événements de synchronisation apparaîtront ici dès que vos comptes seront actifs."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Compte</th>
                  <th className="px-5 py-3">Expéditeur</th>
                  <th className="px-5 py-3">Sujet / pièce jointe</th>
                  <th className="px-5 py-3 text-right">Durée</th>
                  <th className="px-5 py-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4 align-top text-xs font-semibold text-slate-500">
                      {new Date(log.createdAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-5 py-4 align-top text-sm font-semibold text-slate-800">
                      {log.accountName}
                    </td>
                    <td className="px-5 py-4 align-top font-mono text-xs text-slate-600">
                      {maskAddress(log.from)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-slate-800">
                        {log.attachmentName ?? log.subject ?? "—"}
                      </p>
                      {log.attachmentName && log.subject ? (
                        <p className="text-xs text-slate-500">{log.subject}</p>
                      ) : null}
                      {log.errorMessage ? (
                        <p className="mt-1 text-xs text-rose-700">{log.errorMessage}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 align-top text-right text-xs font-medium text-slate-500">
                      {log.durationMs > 0 ? `${log.durationMs} ms` : "—"}
                    </td>
                    <td className="px-5 py-4 align-top text-right">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone(log.status)}`}
                      >
                        {statusIcon(log.status)}
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </main>
  );
}
