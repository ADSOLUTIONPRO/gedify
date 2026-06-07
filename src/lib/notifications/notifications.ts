import "server-only";

import { readStore, writeStore } from "@/lib/engine/stores";
import { listReminders } from "@/lib/actions/reminder-store";
import { listJobs } from "@/lib/jobs/job-store";
import { listAudit } from "@/lib/audit/audit-store";

/* Notifications GED « toutes confondues » : agrège des sources existantes
   (rappels échus, jobs en erreur, actions journalisées notables) en une liste
   unique. État lu/effacé persisté (clés readStore "notification-state"). */

export type NotifTone = "info" | "warning" | "error" | "success";
export type GedNotification = {
  id: string;
  type: "reminder" | "job" | "activity";
  title: string;
  detail?: string;
  at: string;
  href?: string;
  tone: NotifTone;
};

type NotifState = { lastReadAt: string; clearedBefore: string };
const EPOCH = "1970-01-01T00:00:00.000Z";
const STATE_KEY = "notification-state";

async function getState(): Promise<NotifState> {
  const v = (await readStore<Partial<NotifState>>(STATE_KEY, {})) ?? {};
  return { lastReadAt: v.lastReadAt ?? EPOCH, clearedBefore: v.clearedBefore ?? EPOCH };
}

export async function markAllNotificationsRead(): Promise<void> {
  const s = await getState();
  await writeStore(STATE_KEY, { ...s, lastReadAt: new Date().toISOString() });
}

/** « Tout supprimer » = masquer tout ce qui existe aujourd'hui (non destructif :
    on ne supprime pas les rappels/jobs sous-jacents). */
export async function clearAllNotifications(): Promise<void> {
  const now = new Date().toISOString();
  await writeStore(STATE_KEY, { lastReadAt: now, clearedBefore: now });
}

async function collect(): Promise<GedNotification[]> {
  const out: GedNotification[] = [];
  const now = Date.now();

  try {
    const reminders = await listReminders();
    for (const r of reminders) {
      if (r.status === "scheduled" && new Date(r.remindAt).getTime() <= now) {
        out.push({ id: `rem-${r.id}`, type: "reminder", title: r.title || "Rappel", detail: r.notes || undefined, at: r.remindAt, href: "/rappels", tone: "warning" });
      }
    }
  } catch {
    /* rappels indisponibles */
  }

  try {
    const jobs = await listJobs();
    for (const j of jobs.filter((x) => x.status === "failed").slice(0, 25)) {
      out.push({
        id: `job-${j.id}`,
        type: "job",
        title: `Échec ${j.type}`,
        detail: `Document #${j.documentId}${j.lastError ? " — " + j.lastError.slice(0, 90) : ""}`,
        at: j.finishedAt ?? j.createdAt,
        href: "/administration/sante",
        tone: "error",
      });
    }
  } catch {
    /* jobs indisponibles */
  }

  try {
    const audit = await listAudit(60);
    for (const a of audit) {
      const notable = a.result === "error" || /trash|bulk|workflow\.|mail\.send|backup|taxonomy\.merge/.test(a.action);
      if (!notable) continue;
      out.push({
        id: `aud-${a.id}`,
        type: "activity",
        title: a.action,
        detail: [a.target, a.details].filter(Boolean).join(" · ") || undefined,
        at: a.at,
        href: "/administration/roles",
        tone: a.result === "error" ? "error" : a.result === "denied" ? "warning" : "info",
      });
    }
  } catch {
    /* audit indisponible */
  }

  return out;
}

export async function listNotifications(): Promise<{ items: GedNotification[]; unreadCount: number; lastReadAt: string }> {
  const state = await getState();
  const all = await collect();
  const items = all
    .filter((n) => n.at > state.clearedBefore)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 50);
  const unreadCount = items.filter((n) => n.at > state.lastReadAt).length;
  return { items, unreadCount, lastReadAt: state.lastReadAt };
}
