import "server-only";

import { readStore, writeStore } from "@/lib/engine/stores";
import {
  NOTIFICATION_EVENTS,
  getEventDef,
  type NotifFrequency,
  type NotifSeverity,
} from "@/lib/notifications/notification-catalog";

/* ────────────────────────────────────────────────────────────────────────
   Préférences de notifications PAR UTILISATEUR.

   Persistées via readStore/writeStore (clé "notification-preferences") : un objet
   { [userId]: NotificationPreferences }. Compatible JSON / SQLite / Postgres
   (le routage stockage est transparent). On ne stocke que les SURCHARGES par
   type d'événement ; les défauts viennent du catalogue → store compact.
   ──────────────────────────────────────────────────────────────────────── */

const STORE_KEY = "notification-preferences";

export type EventPreference = {
  inApp: boolean;
  email: boolean;
  frequency: NotifFrequency;
  severityThreshold: NotifSeverity;
};

export type QuietHours = {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string;
  days: number[]; // 0=dimanche … 6=samedi
  allowCritical: boolean;
};

export type DigestPreference = {
  dailyEnabled: boolean;
  dailyTime: string;
  weeklyEnabled: boolean;
  weeklyDay: number;
  weeklyTime: string;
};

export type NotificationPreferences = {
  emailEnabled: boolean;
  emailAddress: string | null;
  quietHours: QuietHours;
  digest: DigestPreference;
  retentionDays: 30 | 90 | 180 | 0; // 0 = illimité
  /** Surcharges par type d'événement (sparse). */
  events: Record<string, Partial<EventPreference>>;
};

export const DEFAULT_GENERAL: Omit<NotificationPreferences, "events"> = {
  emailEnabled: false,
  emailAddress: null,
  quietHours: { enabled: false, start: "22:00", end: "07:00", days: [0, 1, 2, 3, 4, 5, 6], allowCritical: true },
  digest: { dailyEnabled: false, dailyTime: "08:00", weeklyEnabled: false, weeklyDay: 1, weeklyTime: "08:00" },
  retentionDays: 90,
};

export function defaultEventPreference(type: string): EventPreference {
  const def = getEventDef(type);
  return {
    inApp: def?.defaultInApp ?? true,
    email: def?.defaultEmail ?? false,
    frequency: "immediate",
    severityThreshold: def?.defaultSeverity ?? "normal",
  };
}

type Stored = Record<string, NotificationPreferences>;

async function readAll(): Promise<Stored> {
  return (await readStore<Stored>(STORE_KEY, {})) ?? {};
}

/** Préférences brutes stockées (surcharges) pour un utilisateur. */
export async function getRawUserPreferences(userId: string): Promise<NotificationPreferences> {
  const all = await readAll();
  const p = all[userId];
  return {
    ...DEFAULT_GENERAL,
    ...(p ?? {}),
    quietHours: { ...DEFAULT_GENERAL.quietHours, ...(p?.quietHours ?? {}) },
    digest: { ...DEFAULT_GENERAL.digest, ...(p?.digest ?? {}) },
    events: p?.events ?? {},
  };
}

export async function saveUserPreferences(userId: string, prefs: NotificationPreferences): Promise<void> {
  const all = await readAll();
  all[userId] = prefs;
  await writeStore(STORE_KEY, all);
}

/** Réinitialise un utilisateur aux valeurs par défaut (supprime ses surcharges). */
export async function resetUserPreferences(userId: string): Promise<void> {
  const all = await readAll();
  delete all[userId];
  await writeStore(STORE_KEY, all);
}

/** Préférence RÉSOLUE (défaut catalogue + surcharge) pour un type d'événement. */
export function resolveEventPreference(prefs: NotificationPreferences, type: string): EventPreference {
  return { ...defaultEventPreference(type), ...(prefs.events[type] ?? {}) };
}

/** Vue complète résolue pour l'UI : général + map type→EventPreference. */
export async function getResolvedUserPreferences(userId: string): Promise<{
  general: Omit<NotificationPreferences, "events">;
  events: Record<string, EventPreference>;
}> {
  const prefs = await getRawUserPreferences(userId);
  const events: Record<string, EventPreference> = {};
  for (const def of NOTIFICATION_EVENTS) events[def.type] = resolveEventPreference(prefs, def.type);
  const general: Omit<NotificationPreferences, "events"> = {
    emailEnabled: prefs.emailEnabled,
    emailAddress: prefs.emailAddress,
    quietHours: prefs.quietHours,
    digest: prefs.digest,
    retentionDays: prefs.retentionDays,
  };
  return { general, events };
}

const SEVERITY_ORDER: NotifSeverity[] = ["info", "normal", "important", "critical"];

/** L'événement (type+severity) doit-il produire une notif in-app pour cet utilisateur ? */
export function shouldNotifyInApp(prefs: NotificationPreferences, type: string, severity: NotifSeverity): boolean {
  const ev = resolveEventPreference(prefs, type);
  if (!ev.inApp || ev.frequency === "off") return false;
  return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(ev.severityThreshold);
}

/** L'événement doit-il produire un email (respecte emailEnabled global) ? */
export function shouldNotifyEmail(prefs: NotificationPreferences, type: string, severity: NotifSeverity): boolean {
  if (!prefs.emailEnabled) return false;
  const ev = resolveEventPreference(prefs, type);
  if (!ev.email || ev.frequency === "off") return false;
  return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(ev.severityThreshold);
}
