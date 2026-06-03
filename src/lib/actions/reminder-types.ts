/**
 * Rappel attaché à une ActionItem (ou à un FinancialItem). Permet de re-notifier
 * l'utilisateur avant l'échéance via différents canaux. Stub "à connecter" pour
 * les canaux externes (email, push).
 */

export type ReminderChannel = "in_app" | "email" | "notification";

export type ReminderStatus = "scheduled" | "sent" | "snoozed" | "cancelled";

export type Reminder = {
  id: string;
  /** Soit linkedActionId, soit linkedFinancialItemId est défini (idéalement les deux). */
  linkedActionId: string | null;
  linkedFinancialItemId: string | null;
  /** Quand le rappel doit se déclencher (ISO). */
  triggerAt: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  /** Adresse de destination quand `channel = email`. */
  emailRecipient: string | null;
  /** Message court à afficher / envoyer. */
  message: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};
