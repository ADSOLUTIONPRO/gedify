import type { Metadata } from "next";
import { AdministrationSettings } from "@/components/settings/administration-settings";
import { getPaperlessStatus } from "@/lib/paperless";
import { getGedifyFeatureFlags } from "@/lib/settings/feature-flags";
import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";
import { listSignatures } from "@/lib/messaging/email-signature-store";
import { getHiddenSenderEmails } from "@/lib/messaging/hidden-senders-store";
import { listGedWorkflows } from "@/lib/ged/ged-store";
import { listServerBackups, backupRetention } from "@/lib/transfer/backup";
import { safePaperlessCollection } from "@/lib/paperless-resources";
import { isOnlyOfficeConfigured, getOnlyOfficeServerUrl } from "@/lib/writer/onlyoffice-config";
import { getDataDir } from "@/lib/storage/data-dir";
import { listAudit } from "@/lib/audit/audit-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paramètres — Administration" };

/** Page UNIQUE des paramètres. Réunit tous les réglages (réutilise les panneaux/
    données déjà câblés) ; les écrans métier restent accessibles via « Gérer ». */
export default async function AdministrationParametresPage() {
  const [status, flags, gmailAccounts, signatures, hidden, workflows, backups, customFields, audit] = await Promise.all([
    getPaperlessStatus().catch(() => null),
    getGedifyFeatureFlags().catch(() => ({ financeSpaceEnabled: true, autoBudgetClassificationEnabled: true, autoAiAnalysisEnabled: true, autoContactSyncEnabled: true })),
    listGmailAccounts().catch(() => []),
    listSignatures().catch(() => []),
    getHiddenSenderEmails().catch(() => new Set<string>()),
    listGedWorkflows().catch(() => [] as unknown[]),
    listServerBackups().catch(() => [] as { createdAt: string }[]),
    safePaperlessCollection("/api/custom_fields/").catch(() => ({ ok: false as const })),
    listAudit(1).catch(() => [] as { at: string }[]),
  ]);

  const storageTotal = status?.system?.storage?.total ?? 0;
  const storageAvailable = status?.system?.storage?.available ?? 0;
  const storageUsedPercent = storageTotal > 0 ? Math.round(((storageTotal - storageAvailable) / storageTotal) * 100) : null;
  const lastBackupAt = [...backups].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]?.createdAt ?? null;
  const customFieldsCount = customFields.ok ? (customFields.data.count ?? customFields.data.results.length) : null;
  const dataDir = (() => { try { return getDataDir(); } catch { return "—"; } })();

  return (
    <AdministrationSettings
      account={{ email: status?.user?.email ?? null, mfa: Boolean(status?.user?.is_mfa_enabled) }}
      engine={{ connected: Boolean(status?.connected), version: status?.version ?? null, apiVersion: status?.apiVersion ?? null, error: status?.error ?? null }}
      storageUsedPercent={storageUsedPercent}
      initialFlags={{
        financeSpaceEnabled: flags.financeSpaceEnabled,
        autoBudgetClassificationEnabled: flags.autoBudgetClassificationEnabled,
        autoAiAnalysisEnabled: flags.autoAiAnalysisEnabled,
        autoContactSyncEnabled: flags.autoContactSyncEnabled,
      }}
      counts={{ gmailAccounts: gmailAccounts.length, signatures: signatures.length, customFields: customFieldsCount, workflows: workflows.length, hiddenSenders: hidden.size }}
      lastBackupAt={lastBackupAt}
      office={{ configured: isOnlyOfficeConfigured(), url: getOnlyOfficeServerUrl() }}
      storageLocation={dataDir}
      backup={{ retention: backupRetention(), count: backups.length }}
      lastActivityAt={audit[0]?.at ?? null}
    />
  );
}
