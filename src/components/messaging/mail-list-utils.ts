import type { EmailThreadRecord } from "@/lib/messaging/email-types";

/** Palette d'avatars déterministe (initiales → couleur stable). */
const AVATAR_COLORS = [
  "#4285F4", "#EA4335", "#FBBC04", "#34A853",
  "#FF6D00", "#46BDC6", "#7B61FF", "#E91E63",
  "#009688", "#795548",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Date courte pour la liste : « 14:32 » le jour même, sinon « 05 juin ». */
export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/** Date longue pour le volet de lecture : « 5 juin 2026 à 09:41 ». */
export function formatFull(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function senderEmail(t: EmailThreadRecord): string {
  return t.participants[0]?.email ?? "";
}

export function senderName(t: EmailThreadRecord): string {
  const p = t.participants[0];
  if (!p) return "(inconnu)";
  return p.name ?? p.email;
}
