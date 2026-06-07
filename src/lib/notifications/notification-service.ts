import "server-only";

import { randomUUID } from "node:crypto";
import { readStore, writeStore } from "@/lib/engine/stores";
import { getRawUserPreferences, shouldNotifyInApp, shouldNotifyEmail } from "./notification-preferences";
import { getEventDef, type NotifSeverity } from "./notification-catalog";

/* ────────────────────────────────────────────────────────────────────────
   NotificationService — point d'entrée CENTRAL des notifications.

   Les modules GEDify n'envoient PAS d'email eux-mêmes : ils appellent
   `notifyUser(userId, { type, ... })`. Le service applique les préférences
   utilisateur (canal in-app / email, niveau minimal, fréquence), déduplique,
   persiste la notification in-app et prépare l'email (envoi réel à brancher).

   Stockage : "notification-records" = { [userId]: NotificationRecord[] }
   (readStore/writeStore → compatible JSON / SQLite / Postgres).
   ──────────────────────────────────────────────────────────────────────── */

const RECORDS_KEY = "notification-records";

export type NotificationRecord = {
  id: string;
  userId: string;
  type: string;
  category: string;
  title: string;
  message?: string;
  severity: NotifSeverity;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  dedupeKey?: string;
};

export type NotifyInput = {
  type: string;
  title: string;
  message?: string;
  severity?: NotifSeverity;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  /** Clé de déduplication (ex. "mail:new:accountId:hour"). */
  dedupeKey?: string;
};

type Store = Record<string, NotificationRecord[]>;

async function readAll(): Promise<Store> {
  return (await readStore<Store>(RECORDS_KEY, {})) ?? {};
}
async function writeAll(s: Store): Promise<void> {
  await writeStore(RECORDS_KEY, s);
}

/**
 * Notifie un utilisateur d'un événement. Respecte ses préférences (canal, niveau),
 * déduplique (même dedupeKey < 6 h), persiste l'in-app, prépare l'email.
 */
export async function notifyUser(userId: string, input: NotifyInput): Promise<{ recorded: boolean; emailed: boolean }> {
  const def = getEventDef(input.type);
  const severity = input.severity ?? def?.defaultSeverity ?? "normal";
  const prefs = await getRawUserPreferences(userId);

  const wantInApp = shouldNotifyInApp(prefs, input.type, severity);
  const wantEmail = shouldNotifyEmail(prefs, input.type, severity);

  let recorded = false;
  if (wantInApp) {
    const all = await readAll();
    const list = all[userId] ?? [];
    const since = Date.now() - 6 * 3600_000;
    const isDup = Boolean(
      input.dedupeKey && list.some((r) => r.dedupeKey === input.dedupeKey && new Date(r.createdAt).getTime() > since),
    );
    if (!isDup) {
      list.unshift({
        id: randomUUID(),
        userId,
        type: input.type,
        category: def?.category ?? "documents",
        title: input.title,
        message: input.message,
        severity,
        entityType: input.entityType,
        entityId: input.entityId,
        actionUrl: input.actionUrl,
        isRead: false,
        createdAt: new Date().toISOString(),
        dedupeKey: input.dedupeKey,
      });
      all[userId] = list.slice(0, 200);
      await writeAll(all);
      recorded = true;
    }
  }

  if (wantEmail) {
    // Canal email PRÉPARÉ : l'envoi réel reste à brancher (sendNotificationEmail).
    // On ne logue jamais de contenu sensible — type + niveau seulement.
    console.log(`[notif] email préparé type=${input.type} severity=${severity} (envoi non câblé)`);
  }

  return { recorded, emailed: wantEmail };
}

/** Notifie plusieurs utilisateurs (ex. admins). */
export async function notifyUsers(userIds: string[], input: NotifyInput): Promise<void> {
  await Promise.all(userIds.map((u) => notifyUser(u, input)));
}

export async function listUserNotifications(userId: string): Promise<NotificationRecord[]> {
  const all = await readAll();
  return (all[userId] ?? []).slice(0, 100);
}

export async function markUserNotificationRead(userId: string, id: string): Promise<void> {
  const all = await readAll();
  const list = all[userId];
  if (!list) return;
  const n = list.find((r) => r.id === id);
  if (n && !n.isRead) {
    n.isRead = true;
    n.readAt = new Date().toISOString();
    await writeAll(all);
  }
}

export async function markAllUserNotificationsRead(userId: string): Promise<void> {
  const all = await readAll();
  const list = all[userId];
  if (!list) return;
  const now = new Date().toISOString();
  let changed = false;
  for (const r of list) if (!r.isRead) { r.isRead = true; r.readAt = now; changed = true; }
  if (changed) await writeAll(all);
}

export async function deleteUserNotification(userId: string, id: string): Promise<void> {
  const all = await readAll();
  if (!all[userId]) return;
  all[userId] = all[userId].filter((r) => r.id !== id);
  await writeAll(all);
}
