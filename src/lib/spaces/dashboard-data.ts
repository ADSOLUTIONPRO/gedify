import "server-only";

import { listReminders } from "@/lib/actions/reminder-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { paperlessFetch } from "@/lib/paperless";
import type {
  PaperlessDocument,
  PaperlessListResponse,
  PaperlessStatistics,
  PaperlessSystemStatus,
} from "@/lib/paperless-types";

export type ActivityItem = { title: string; when: string };
export type DateTone = "danger" | "warning" | "info" | "muted";
export type AgendaItem = { title: string; dateLabel: string; badge: string; tone: DateTone };
export type AdminItem = { label: string; value: string; tone: "success" | "warning" | "danger" | "default" };

/**
 * Données réelles agrégées pour le dashboard d'accueil (maquette validée
 * `/public/refontedesign`). Toutes les sources sont lues en parallèle et
 * dégradent proprement (0 / liste vide) si l'une échoue — l'affichage n'est
 * jamais bloqué (Paperless injoignable, stores vides, etc.).
 */
export type DashboardData = {
  documents: { total: number; inbox: number };
  messagerie: { accounts: number; unread: number };
  finances: { toCollect: number; overdue: number; dueSoon: number; total: number };
  ia: { total: number; toValidate: number; validated: number };
  calendrier: { upcoming: number; items: AgendaItem[] };
  contacts: { total: number };
  rappels: { active: number; items: AgendaItem[] };
  administration: {
    paperlessConnected: boolean;
    aiProvider: string | null;
    storageUsedPct: number | null;
    alerts: number;
    items: AdminItem[];
  };
  recentActivity: ActivityItem[];
  upcomingReminders: AgendaItem[];
};

const DAY_MS = 86_400_000;

/** « Il y a 2 h » / « Il y a 3 j » / « À l'instant ». */
function relativeFromNow(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  if (diff < 60_000) return "À l'instant";
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < DAY_MS) return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  return `Il y a ${Math.floor(diff / DAY_MS)} j`;
}

/** Badge d'échéance « Dans X jours » / « Aujourd'hui » / « En retard ». */
function dueBadge(iso: string): { badge: string; tone: DateTone } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / DAY_MS);
  if (days < 0) return { badge: "En retard", tone: "danger" };
  if (days === 0) return { badge: "Aujourd'hui", tone: "danger" };
  if (days === 1) return { badge: "Demain", tone: "warning" };
  if (days <= 4) return { badge: `Dans ${days} jours`, tone: "warning" };
  return { badge: `Dans ${days} jours`, tone: "info" };
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export async function getDashboardData(): Promise<DashboardData> {
  const [statsRes, systemRes, recentDocsRes, remindersRes, itemsRes, analysesRes, accountsRes] =
    await Promise.allSettled([
      paperlessFetch<PaperlessStatistics>("/api/statistics/"),
      paperlessFetch<PaperlessSystemStatus>("/api/status/"),
      paperlessFetch<PaperlessListResponse<PaperlessDocument>>("/api/documents/", {
        searchParams: { page_size: 4, ordering: "-added" },
      }),
      listReminders(),
      listFinancialItems(),
      listAnalyses(),
      listAccounts(),
    ]);

  const pStats = statsRes.status === "fulfilled" ? statsRes.value : null;
  const paperlessConnected = statsRes.status === "fulfilled";

  // Analyses IA
  const analyses = analysesRes.status === "fulfilled" ? analysesRes.value : [];
  const iaToValidate = analyses.filter((a) => a.status === "ready-to-validate").length;
  const iaValidated = analyses.filter((a) => a.status === "validated" || a.status === "applied").length;

  // Finances
  const items = itemsRes.status === "fulfilled" ? itemsRes.value : [];
  const finOverdue = items.filter((i) => i.paymentStatus === "overdue").length;
  const finDueSoon = items.filter((i) => i.paymentStatus === "due_soon" || i.paymentStatus === "due").length;
  const toCollect = items
    .filter((i) => i.direction === "incoming" && i.paymentStatus !== "paid")
    .reduce((sum, i) => sum + (i.amountRemaining ?? i.amount ?? 0), 0);

  // Rappels (échéances datées) — réutilisés aussi pour l'agenda du calendrier.
  const reminders = remindersRes.status === "fulfilled" ? remindersRes.value : [];
  const scheduled = reminders
    .filter((r) => r.status === "scheduled")
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt));
  const agenda: AgendaItem[] = scheduled.slice(0, 4).map((r) => {
    const { badge, tone } = dueBadge(r.remindAt);
    return { title: r.title, dateLabel: DATE_FMT.format(new Date(r.remindAt)), badge, tone };
  });

  // Contacts / organiser
  const correspondents = pStats?.correspondent_count ?? 0;
  const accounts = accountsRes.status === "fulfilled" ? accountsRes.value : [];

  // Activité récente (documents Paperless récents)
  const recentDocs = recentDocsRes.status === "fulfilled" ? recentDocsRes.value.results ?? [] : [];
  const recentActivity: ActivityItem[] = recentDocs.slice(0, 4).map((doc) => ({
    title: doc.title || doc.original_file_name || `Document ${doc.id}`,
    when: relativeFromNow(doc.added ?? doc.created ?? doc.created_date),
  }));

  // Administration / système
  const system = systemRes.status === "fulfilled" ? systemRes.value : null;
  let storageUsedPct: number | null = null;
  if (system?.storage?.total && system.storage.total > 0 && typeof system.storage.available === "number") {
    storageUsedPct = Math.round(((system.storage.total - system.storage.available) / system.storage.total) * 100);
  }
  const aiProvider = process.env.AI_PROVIDER?.trim() || null;
  const adminItems: AdminItem[] = [
    {
      label: "Paperless",
      value: paperlessConnected ? "Connecté" : "Indisponible",
      tone: paperlessConnected ? "success" : "danger",
    },
    {
      label: "Stockage",
      value: storageUsedPct !== null ? `${storageUsedPct} %` : "—",
      tone: storageUsedPct !== null && storageUsedPct >= 90 ? "warning" : "default",
    },
    { label: "Fournisseur IA", value: aiProvider ?? "Non configuré", tone: aiProvider ? "default" : "warning" },
  ];
  const alerts = (paperlessConnected ? 0 : 1) + (storageUsedPct !== null && storageUsedPct >= 90 ? 1 : 0);

  return {
    documents: { total: pStats?.documents_total ?? 0, inbox: pStats?.documents_inbox ?? 0 },
    messagerie: { accounts: accounts.length, unread: 0 },
    finances: { toCollect: Math.round(toCollect), overdue: finOverdue, dueSoon: finDueSoon, total: items.length },
    ia: { total: analyses.length, toValidate: iaToValidate, validated: iaValidated },
    calendrier: { upcoming: scheduled.length, items: agenda },
    contacts: { total: correspondents },
    rappels: { active: scheduled.length, items: agenda },
    administration: { paperlessConnected, aiProvider, storageUsedPct, alerts, items: adminItems },
    recentActivity,
    upcomingReminders: agenda,
  };
}
