/** Vue d'une boîte mail côté client (miroir de MailAccountVM serveur). */
export type MailAccountStatus = "active" | "error" | "reconnect" | "disabled" | "pending";

export type MailAccountVM = {
  id: string;
  email: string;
  name: string;
  provider: string;
  providerLabel: string;
  isGmail: boolean;
  connector: "imap" | "gmail-oauth" | null;
  authType: string;
  authLabel: string;
  isActive: boolean;
  isDefault: boolean;
  canSend: boolean;
  color: string | null;
  syncIntervalMinutes: number;
  watchedFolder: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  messages: number | null;
  status: MailAccountStatus;
  scopes: string[];
  connectedAt: string | null;
};

export type SignatureVM = { id: string; name: string; html: string; isDefault: boolean; mailbox: string | null };

/** Palette de couleurs de compte (charte GEDify). */
export const ACCOUNT_COLORS = ["#F75C8D", "#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#94A3B8"];

export function statusMeta(status: MailAccountStatus): { label: string; color: string; bg: string } {
  switch (status) {
    case "active": return { label: "Actif", color: "#15803D", bg: "var(--gedify-green-soft)" };
    case "error": return { label: "Erreur", color: "#B91C1C", bg: "var(--gedify-red-soft)" };
    case "reconnect": return { label: "À reconnecter", color: "#B45309", bg: "#FFF7ED" };
    case "disabled": return { label: "Désactivé", color: "#64748B", bg: "var(--bg-card-soft)" };
    case "pending": return { label: "En attente", color: "#7C3AED", bg: "#F5F3FF" };
  }
}

/** « il y a 20 h », « À l'instant », date. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "Jamais";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "Jamais";
  const min = Math.round((Date.now() - d) / 60_000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export const SYNC_OPTIONS = [
  { value: 15, label: "Toutes les 15 minutes" },
  { value: 30, label: "Toutes les 30 minutes" },
  { value: 60, label: "Toutes les heures" },
  { value: 360, label: "Toutes les 6 heures" },
  { value: 0, label: "Manuellement" },
];
