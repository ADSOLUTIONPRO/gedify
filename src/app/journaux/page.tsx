import { AlertTriangle, CheckCircle2, Mail, ScrollText } from "lucide-react";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { CompactPageHeader } from "@/components/ui/compact-page-header";
import { InfoMetric } from "@/components/ui/info-metric";
import { LogTable, type LogRow } from "@/components/ui/log-table";
import { PageShell } from "@/components/ui/page-shell";
import { listGedLogs } from "@/lib/ged/ged-store";
import { listLogs as listMailLogs } from "@/lib/mail-connector/log-store";
import { safePaperlessCollection } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function normalizeLevel(value: unknown): LogRow["level"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("error") || text.includes("fail")) return "error";
  if (text.includes("warn")) return "warning";
  if (text.includes("success") || text.includes("imported")) return "success";
  return "info";
}

export default async function JournauxPage() {
  const [paperless, gedLogs, mailLogs] = await Promise.all([
    safePaperlessCollection("/api/logs/"),
    listGedLogs(120),
    listMailLogs({ limit: 120 }),
  ]);

  const paperlessRows: LogRow[] = paperless.ok
    ? paperless.data.results.map((row, index) => ({
        id: `paperless-${String(row.id ?? index)}`,
        level: normalizeLevel(row.level ?? row.status),
        source: "Gedify",
        message: String(row.message ?? row.msg ?? row.name ?? "Événement Gedify"),
        date: formatDate(String(row.created ?? row.created_at ?? row.timestamp ?? "")),
        details: JSON.stringify(row, null, 2),
      }))
    : [];

  const gedRows: LogRow[] = gedLogs.map((log) => ({
    id: log.id,
    level: log.level,
    source: log.source,
    message: log.message,
    date: formatDate(log.createdAt),
    details: log.details,
  }));

  const mailRows: LogRow[] = mailLogs.map((log) => ({
    id: log.id,
    level: log.status === "error" ? "error" : log.status === "imported" ? "success" : "info",
    source: "Email",
    message:
      log.status === "error"
        ? log.errorMessage ?? "Erreur de synchronisation email"
        : `${log.attachmentName ?? log.subject ?? "Email"} · ${log.status}`,
    date: formatDate(log.createdAt),
    details: JSON.stringify(log, null, 2),
  }));

  const rows = [...gedRows, ...mailRows, ...paperlessRows].slice(0, 160);
  const errors = rows.filter((row) => row.level === "error").length;
  const warnings = rows.filter((row) => row.level === "warning").length;

  return (
    <PageShell>
      <CompactPageHeader
        eyebrow="Supervision"
        title="Journaux"
        description="Messages utiles en premier niveau. Les détails techniques restent repliés."
        backLink={{ href: "/administration", label: "Administration" }}
      />

      <section className="grid gap-2.5 sm:grid-cols-3">
        <InfoMetric label="Entrées" value={rows.length} icon={ScrollText} tone="blue" />
        <InfoMetric label="Erreurs" value={errors} icon={AlertTriangle} tone={errors > 0 ? "red" : "green"} />
        <InfoMetric label="Emails" value={mailRows.length} icon={Mail} tone="violet" />
      </section>

      {rows.length === 0 ? (
        <CompactEmptyState
          icon={CheckCircle2}
          title="Aucun journal récent"
          description="Les logs Gedify, GED et mail apparaîtront ici après les premières actions."
        />
      ) : (
        <LogTable rows={rows} />
      )}

      {warnings > 0 ? (
        <p className="text-xs text-slate-500">
          Les avertissements sont conservés pour diagnostic, sans afficher les données brutes par défaut.
        </p>
      ) : null}
    </PageShell>
  );
}
